export function personalize(html, name, edition, refCode) {
  return html
    .replace(/\{\{NAME\}\}/g, name || 'Friend')
    .replace(/\{\{REF_CODE\}\}/g, refCode || '')
    .replace(/\{\{EDITION\}\}/g, edition || 'GH');
}

async function sendViaBrevo(env, to, subject, htmlContent) {
  const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
    body: JSON.stringify({
      sender: { name: 'Studio Gabochie', email: 'newsletter@gabochie.com' },
      to: Array.isArray(to) ? to : [to],
      subject: subject,
      htmlContent: htmlContent
    })
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error('Brevo ' + resp.status + ': ' + errText);
  }
  return resp;
}

import { requireAdmin } from '../../_auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }
  // Note: enqueueing needs no Brevo key — only the drain sends.
  try {
    const { subject, html, test_email, theme } = await request.json();
    if (!subject || !html) {
      return new Response(JSON.stringify({ status: 'error', message: 'subject and html required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // If test_email is set, look up subscriber for personalization
    if (test_email) {
      const sub = await env.DB.prepare("SELECT name, edition, ref_code FROM subscribers WHERE email = ?").bind(test_email).first();
      const name = (sub && sub.name) || 'Gideon';
      const edition = (sub && sub.edition) || 'GH';
      const refCode = (sub && sub.ref_code) || 'GA-TEST';
      const rendered = personalize(html, name, edition, refCode);
      try {
        await sendViaBrevo(env, { email: test_email }, '[TEST] ' + subject, rendered);
      } catch (err) {
        return new Response(JSON.stringify({ status: 'error', message: err.message }), { headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ status: 'ok', message: 'Test sent to ' + test_email + ' (' + edition + ', ' + name + ')' }), { headers: { 'Content-Type': 'application/json' } });
    }

    // Broadcast: enqueue one outbox row per confirmed subscriber.
    // A worker (email cron drain) sends them in bounded batches so large
    // lists never blow the function time limit. The issue archives immediately
    // with status 'sending'; progress is tracked via sent/failed counts.
    const subs = await env.DB.prepare("SELECT email, name, edition, ref_code FROM subscribers WHERE email != '' AND confirmed != 0").all();
    const subscribers = subs.results || [];
    if (subscribers.length === 0) {
      return new Response(JSON.stringify({ status: 'error', message: 'No confirmed subscribers to send to' }), { headers: { 'Content-Type': 'application/json' } });
    }

    // Archive issue first (status 'sending')
    const row = await env.DB.prepare("SELECT COALESCE(MAX(issue_number), 0) + 1 AS next_num FROM newsletter_issues").first();
    const issueNumber = row ? row.next_num : 1;
    const issueInsert = await env.DB.prepare(
      "INSERT INTO newsletter_issues (issue_number, subject, theme, html, subscriber_count, status, sent_count, failed_count) VALUES (?, ?, ?, ?, ?, 'sending', 0, 0)"
    ).bind(issueNumber, subject, theme || '', html, subscribers.length).run();
    const issueId = issueInsert && issueInsert.meta ? issueInsert.meta.last_row_id : issueNumber;

    let enqueued = 0;
    // Row-by-row inserts: portable across D1 and trivially resumable.
    // Enqueue runs once per broadcast in admin (no hot path), so throughput is fine.
    for (let i = 0; i < subscribers.length; i++) {
      const s = subscribers[i];
      await env.DB.prepare(
        'INSERT INTO newsletter_outbox (issue_id, email, name, edition, ref_code, status, attempts) VALUES (?, ?, ?, ?, ?, \'pending\', 0)'
      ).bind(issueId, s.email, s.name || '', s.edition || 'GH', s.ref_code || '').run();
      enqueued++;
    }

    return new Response(JSON.stringify({
      status: 'ok',
      message: `Enqueued ${enqueued} sends for issue #${issueNumber} — draining hourly`,
      enqueued: enqueued,
      total: subscribers.length,
      issue_number: issueNumber,
      issue_id: issueId
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error: ' + err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
