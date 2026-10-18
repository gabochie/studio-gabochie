/**
 * Email Queue Worker
 * Runs every minute via cron trigger
 * Polls email_queue, sends via Brevo, updates status
 */
export default {
  async scheduled(controller, env, ctx) {
    if (!env.BREVO_API_KEY) {
      console.log('BREVO_API_KEY not configured, skipping email worker');
      return;
    }

    const DAILY_LIMIT = 300;
    const BATCH_SIZE = 50;

    try {
      // Check daily sent count
      const today = new Date().toISOString().split('T')[0];
      const countResult = await env.DB.prepare(
        `SELECT COUNT(*) as cnt FROM email_queue 
         WHERE sent_at LIKE ? AND status = 'sent'`
      ).bind(`${today}%`).first();

      const sentToday = countResult?.cnt || 0;
      if (sentToday >= DAILY_LIMIT) {
        console.log(`Daily limit reached (${sentToday}/${DAILY_LIMIT}), skipping`);
        return;
      }

      const remainingToday = DAILY_LIMIT - sentToday;
      const limit = Math.min(BATCH_SIZE, remainingToday);

      // Fetch pending emails ready to send
      const now = new Date().toISOString();
      const pending = await env.DB.prepare(
        `SELECT * FROM email_queue 
         WHERE status = 'pending' 
         AND scheduled_at <= ?
         AND to_email NOT IN (SELECT email FROM suppression_list)
         ORDER BY scheduled_at ASC
         LIMIT ?`
      ).bind(now, limit).all();

      if (!pending.results || pending.results.length === 0) {
        console.log('No pending emails to send');
        return;
      }

      console.log(`Processing ${pending.results.length} emails`);

      for (const email of pending.results) {
        await processEmail(email, env);
        // Small delay to respect Brevo rate limits (10 req/sec)
        await new Promise(r => setTimeout(r, 100));
      }

    } catch (err) {
      console.error('Email worker error:', err);
    }
  }
};

async function processEmail(email, env) {
  const id = email.id;

  try {
    // Update status to sending
    await env.DB.prepare(
      `UPDATE email_queue SET status = 'sending', updated_at = datetime('now') WHERE id = ?`
    ).bind(id).run();

    // Build tracking pixel and click tracking URLs
    const baseUrl = env.PUBLIC_BASE_URL || 'https://studio.gabochie.com';
    const trackingPixel = `<img src="${baseUrl}/api/track/open?mid=${id}&cid=${encodeURIComponent(email.to_email)}" width="1" height="1" alt="" style="display:none">`;
    
    // Inject tracking pixel into HTML
    const htmlWithTracking = email.html_content.replace('</body>', `${trackingPixel}</body>`);

    // Rewrite links for click tracking
    const clickTrackedHtml = rewriteLinksForTracking(htmlWithTracking, baseUrl, id, email.to_email);

    const payload = {
      sender: {
        email: env.BREVO_SMTP_SENDER || 'studio@gabochie.com',
        name: env.BREVO_SMTP_NAME || 'Studio Gabochie'
      },
      to: [{ email: email.to_email, name: email.to_name || '' }],
      subject: email.subject,
      htmlContent: clickTrackedHtml,
      textContent: stripHtml(clickTrackedHtml),
      tags: [email.email_type || 'manual'],
      headers: {
        'X-Message-ID': String(id),
        'X-Contact-Email': email.to_email
      }
    };

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': env.BREVO_API_KEY
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`Brevo API error: ${result.message || response.statusText}`);
    }

    // Success - update queue
    await env.DB.prepare(
      `UPDATE email_queue 
       SET status = 'sent', sent_at = datetime('now'), provider_id = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).bind(result.messageId, id).run();

    console.log(`Email ${id} sent to ${email.to_email} (Brevo ID: ${result.messageId})`);

  } catch (err) {
    // Failure - increment retry count
    const retryCount = (email.retry_count || 0) + 1;
    const maxRetries = 3;

    if (retryCount >= maxRetries) {
      await env.DB.prepare(
        `UPDATE email_queue 
         SET status = 'failed', retry_count = ?, last_error = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).bind(retryCount, err.message, id).run();
      console.error(`Email ${id} failed permanently: ${err.message}`);
    } else {
      await env.DB.prepare(
        `UPDATE email_queue 
         SET status = 'pending', retry_count = ?, last_error = ?, 
             scheduled_at = datetime('now', '+' || ? || ' minutes'), updated_at = datetime('now')
         WHERE id = ?`
      ).bind(retryCount, err.message, retryCount * 5, id).run();
      console.warn(`Email ${id} failed, retry ${retryCount}/${maxRetries}: ${err.message}`);
    }
  }
}

function rewriteLinksForTracking(html, baseUrl, messageId, contactEmail) {
  return html.replace(
    /href=["'](https?:\/\/[^"']+)["']/gi,
    (match, url) => {
      // Skip tracking links and unsubscribe links
      if (url.includes('/api/track/') || url.includes('/unsubscribe')) return match;
      const tracked = `${baseUrl}/api/track/click?url=${encodeURIComponent(url)}&mid=${messageId}&cid=${encodeURIComponent(contactEmail)}`;
      return `href="${tracked}"`;
    }
  );
}

function stripHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}