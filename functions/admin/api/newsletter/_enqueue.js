import { personalize } from './send.js';

// Shared broadcast enqueue: archive the issue, then queue one outbox row per
// confirmed, non-suppressed subscriber. Fast and bounded; the cron drain sends.
// The issue only flips to 'sending' after every outbox row exists.
var MAX_SUBSCRIBERS = 500;

export async function enqueueBroadcast(env, opts) {
  var subject = (opts.subject || '').trim();
  var html = opts.html || '';
  var theme = opts.theme || '';
  if (!subject || !html) {
    return { ok: false, error: 'subject and html required' };
  }
  var db = env.DB;
  var subs = await db.prepare(
    "SELECT email, name, edition, ref_code FROM subscribers " +
      "WHERE email != '' AND confirmed != 0 " +
      "AND email NOT IN (SELECT email FROM suppression_list) " +
      "ORDER BY id ASC LIMIT ?"
  ).bind(MAX_SUBSCRIBERS).all();
  var subscribers = subs.results || [];
  if (!subscribers.length) {
    return { ok: false, error: 'No confirmed subscribers to send to' };
  }

  // issue_number is UNIQUE in setup.js. Recompute + retry on a collision so
  // concurrent broadcasts cannot both claim the same issue number.
  var issueNumber = 0;
  var issueInsert = null;
  var lastError = '';
  for (var attempt = 0; attempt < 5; attempt++) {
    var row = await db.prepare('SELECT COALESCE(MAX(issue_number), 0) + 1 AS next_num FROM newsletter_issues').first();
    issueNumber = (row && row.next_num) || 1;
    try {
      issueInsert = await db.prepare(
        "INSERT INTO newsletter_issues (issue_number, subject, theme, html, subscriber_count, status, sent_count, failed_count) VALUES (?, ?, ?, ?, ?, 'pending', 0, 0)"
      ).bind(issueNumber, subject, theme, html, subscribers.length).run();
      break;
    } catch (err) {
      lastError = String((err && err.message) || err);
      if (!/UNIQUE|constraint/i.test(lastError)) {
        return { ok: false, error: 'Could not create newsletter issue: ' + lastError };
      }
    }
  }
  if (!issueInsert) return { ok: false, error: 'Could not allocate a unique issue number: ' + lastError };
  var issueId = issueInsert && issueInsert.meta ? issueInsert.meta.last_row_id : issueNumber;

  // Insert all outbox rows in one batch where D1 supports it. The issue stays
  // 'pending' until the batch commits, so a failure cannot look like a send.
  var statements = subscribers.map(function (s) {
    return db.prepare(
      "INSERT INTO newsletter_outbox (issue_id, email, name, edition, ref_code, status, attempts) VALUES (?, ?, ?, ?, ?, 'pending', 0)"
    ).bind(issueId, s.email, s.name || '', s.edition || 'GH', s.ref_code || '');
  });
  try {
    if (typeof db.batch === 'function') {
      await db.batch(statements);
    } else {
      for (var i = 0; i < statements.length; i++) await statements[i].run();
    }
  } catch (err) {
    await db.prepare("UPDATE newsletter_issues SET status = 'failed' WHERE id = ? AND status = 'pending'").bind(issueId).run();
    return { ok: false, error: 'Could not enqueue newsletter outbox: ' + String((err && err.message) || err) };
  }

  var flipped = await db.prepare("UPDATE newsletter_issues SET status = 'sending' WHERE id = ? AND status = 'pending'").bind(issueId).run();
  if (!flipped || !flipped.meta || flipped.meta.changes === 0) {
    return { ok: false, error: 'Newsletter issue ' + issueId + ' is no longer pending' };
  }
  return {
    ok: true, issueId: issueId, issueNumber: issueNumber,
    enqueued: subscribers.length, total: subscribers.length,
    truncated: subscribers.length >= MAX_SUBSCRIBERS
  };
}

export { personalize };
