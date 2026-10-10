import { personalize } from './send.js';

// Shared broadcast enqueue: archive the issue as 'sending' and queue one
// outbox row per confirmed subscriber. Used by manual broadcast (send.js)
// and the Saturday scheduled send. Fast and bounded; the cron drain sends.
export async function enqueueBroadcast(env, opts) {
  var subject = (opts.subject || '').trim();
  var html = opts.html || '';
  var theme = opts.theme || '';
  if (!subject || !html) {
    return { ok: false, error: 'subject and html required' };
  }
  const subs = await env.DB.prepare(
    "SELECT email, name, edition, ref_code FROM subscribers WHERE email != '' AND confirmed != 0"
  ).all();
  const subscribers = subs.results || [];
  if (!subscribers.length) {
    return { ok: false, error: 'No confirmed subscribers to send to' };
  }
  const row = await env.DB.prepare(
    'SELECT COALESCE(MAX(issue_number), 0) + 1 AS next_num FROM newsletter_issues'
  ).first();
  const issueNumber = row ? row.next_num : 1;
  const issueInsert = await env.DB.prepare(
    "INSERT INTO newsletter_issues (issue_number, subject, theme, html, subscriber_count, status, sent_count, failed_count) VALUES (?, ?, ?, ?, ?, 'sending', 0, 0)"
  ).bind(issueNumber, subject, theme, html, subscribers.length).run();
  const issueId = issueInsert && issueInsert.meta ? issueInsert.meta.last_row_id : issueNumber;

  let enqueued = 0;
  for (let i = 0; i < subscribers.length; i++) {
    const s = subscribers[i];
    await env.DB.prepare(
      "INSERT INTO newsletter_outbox (issue_id, email, name, edition, ref_code, status, attempts) VALUES (?, ?, ?, ?, ?, 'pending', 0)"
    ).bind(issueId, s.email, s.name || '', s.edition || 'GH', s.ref_code || '').run();
    enqueued++;
  }
  return { ok: true, issueId: issueId, issueNumber: issueNumber, enqueued: enqueued, total: subscribers.length };
}

export { personalize };
