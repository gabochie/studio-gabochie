function personalize(html, name, edition, refCode) {
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
      sender: { name: 'GideonAbochie Studio', email: 'newsletter@gabochie.com' },
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
  if (!env.BREVO_API_KEY) {
    return new Response(JSON.stringify({ status: 'not_configured', message: 'BREVO_API_KEY not set' }), { headers: { 'Content-Type': 'application/json' } });
  }
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

    // Broadcast: query all subscribers with name and edition for personalization
    const subs = await env.DB.prepare("SELECT email, name, edition, ref_code FROM subscribers WHERE email != '' AND confirmed != 0").all();
    const subscribers = subs.results || [];
    if (subscribers.length === 0) {
      return new Response(JSON.stringify({ status: 'error', message: 'No confirmed subscribers to send to' }), { headers: { 'Content-Type': 'application/json' } });
    }

    // Send individually (per-subscriber personalization) with concurrency control
    const CONCURRENCY = 10;
    let sent = 0;
    let failed = 0;
    const errors = [];

    for (let i = 0; i < subscribers.length; i += CONCURRENCY) {
      const batch = subscribers.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(batch.map(async (s) => {
        const rendered = personalize(html, s.name, s.edition, s.ref_code);
        await sendViaBrevo(env, { email: s.email }, subject, rendered);
      }));
      for (const r of results) {
        if (r.status === 'fulfilled') {
          sent++;
        } else {
          failed++;
          errors.push(r.reason ? r.reason.message : 'Unknown');
        }
      }
    }

    // Archive issue
    const row = await env.DB.prepare("SELECT COALESCE(MAX(issue_number), 0) + 1 AS next_num FROM newsletter_issues").first();
    const issueNumber = row ? row.next_num : 1;
    await env.DB.prepare(
      "INSERT INTO newsletter_issues (issue_number, subject, theme, html, subscriber_count) VALUES (?, ?, ?, ?, ?)"
    ).bind(issueNumber, subject, theme || '', html, subscribers.length).run();

    return new Response(JSON.stringify({
      status: 'ok',
      message: `Sent to ${sent} subscribers (${failed} failed)`,
      sent, failed, total: subscribers.length,
      issue_number: issueNumber,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error: ' + err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
