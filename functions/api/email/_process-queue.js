import { sendBrevoEmail } from './_send.js';
import { buildUnsubscribeUrl, unsubscribeFooter, injectUnsubscribeAndPixel } from './_unsubscribe.js';

// Single source of truth for draining email_queue. Called by the protected
// /api/email/cron endpoint (hourly GitHub Actions cron) and by the admin
// "Process Queue Now" action. Guarantees that every send carries a signed
// unsubscribe link + open pixel, skips suppressed addresses, respects the
// daily Brevo cap, and retries with backoff before dead-lettering.
export const EMAIL_DAILY_LIMIT = 300;
export const EMAIL_BATCH_SIZE = 50;
const MAX_RETRIES = 3;

export async function processEmailQueue(env, db, opts) {
  opts = opts || {};
  const summary = { sent: 0, failed: 0, pending: 0, attempted: 0, skipped_limited: false, errors: [] };
  if (!db || !env.BREVO_API_KEY) return summary;

  const dailyLimit = opts.dailyLimit || EMAIL_DAILY_LIMIT;
  const batchSize = opts.batchSize || EMAIL_BATCH_SIZE;

  // Daily cap (Brevo free-tier guard). sent_at is 'YYYY-MM-DD HH:MM:SS', so a
  // lexicographic >= against today's date counts everything sent today.
  const today = new Date().toISOString().split('T')[0];
  const countRow = await db.prepare(
    "SELECT COUNT(*) AS cnt FROM email_queue WHERE status = 'sent' AND sent_at >= ?"
  ).bind(today).first();
  const sentToday = (countRow && countRow.cnt) || 0;
  if (sentToday >= dailyLimit) {
    summary.skipped_limited = true;
    return summary;
  }

  const limit = Math.min(batchSize, dailyLimit - sentToday);
  const now = new Date().toISOString();
  // The suppression filter lives in SQL so LIMIT is applied after filtering
  // (a suppressed head would otherwise block the whole queue).
  const { results } = await db.prepare(
    `SELECT * FROM email_queue
      WHERE status = 'pending' AND scheduled_at <= ?
        AND to_email NOT IN (SELECT email FROM suppression_list)
      ORDER BY scheduled_at ASC LIMIT ?`
  ).bind(now, limit).all();

  const rows = results || [];
  summary.attempted = rows.length;
  summary.pending = rows.length;

  for (const email of rows) {
    const res = await sendQueuedEmail(env, db, email);
    if (res.status === 'sent') { summary.sent++; summary.pending--; }
    else if (res.status === 'failed') { summary.failed++; summary.pending--; }
    else if (res.status === 'retry') { summary.pending--; }
    if (res.error) summary.errors.push('send-' + email.id + ': ' + res.error);
    // Respect Brevo's rate limit (~10 req/sec).
    await new Promise((r) => setTimeout(r, 100));
  }
  return summary;
}

async function sendQueuedEmail(env, db, email) {
  const id = email.id;
  try {
    await db.prepare(
      "UPDATE email_queue SET status = 'sending', updated_at = datetime('now') WHERE id = ?"
    ).bind(id).run();

    const baseUrl = env.PUBLIC_BASE_URL || 'https://studio.gabochie.com';
    const pixel = `<img src="${baseUrl}/api/track/open?mid=${id}&cid=${encodeURIComponent(email.to_email)}" width="1" height="1" alt="" style="display:none">`;
    const unsubUrl = await buildUnsubscribeUrl(baseUrl, email.to_email, env);
    const withFooter = injectUnsubscribeAndPixel(email.html_content, unsubscribeFooter(unsubUrl), pixel);
    const trackedHtml = rewriteLinksForTracking(withFooter, baseUrl, id, email.to_email);

    const result = await sendBrevoEmail(
      env, email.to_email, email.to_name, email.subject, trackedHtml,
      { tags: [email.email_type || 'manual'] }
    );
    const providerId = (result && result.messageId) || null;

    await db.prepare(
      `UPDATE email_queue SET status = 'sent', sent_at = datetime('now'),
         provider_id = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(providerId, id).run();
    return { status: 'sent', provider_id: providerId };
  } catch (err) {
    const retryCount = (email.retry_count || 0) + 1;
    const message = String((err && err.message) || err).slice(0, 500);
    if (retryCount >= MAX_RETRIES) {
      await db.prepare(
        `UPDATE email_queue SET status = 'failed', retry_count = ?,
           last_error = ?, updated_at = datetime('now') WHERE id = ?`
      ).bind(retryCount, message, id).run();
      return { status: 'failed', error: message };
    }
    await db.prepare(
      `UPDATE email_queue SET status = 'pending', retry_count = ?, last_error = ?,
         scheduled_at = datetime('now', '+' || ? || ' minutes'), updated_at = datetime('now')
       WHERE id = ?`
    ).bind(retryCount, message, retryCount * 5, id).run();
    return { status: 'retry', error: message };
  }
}

function rewriteLinksForTracking(html, baseUrl, messageId, contactEmail) {
  return html.replace(
    /href=["'](https?:\/\/[^"']+)["']/gi,
    (match, url) => {
      if (url.includes('/api/track/') || url.includes('/unsubscribe')) return match;
      const tracked = `${baseUrl}/api/track/click?url=${encodeURIComponent(url)}&mid=${messageId}&cid=${encodeURIComponent(contactEmail)}`;
      return `href="${tracked}"`;
    }
  );
}
