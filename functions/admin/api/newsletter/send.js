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
import { enqueueBroadcast } from './_enqueue.js';

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

    // Broadcast: enqueue via the shared module (cron drain sends).
    const result = await enqueueBroadcast(env, { subject: subject, html: html, theme: theme });
    if (!result.ok) {
      return new Response(JSON.stringify({ status: 'error', message: result.error }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      status: 'ok',
      message: `Enqueued ${result.enqueued} sends for issue #${result.issueNumber} — draining hourly`,
      enqueued: result.enqueued,
      total: result.total,
      issue_number: result.issueNumber,
      issue_id: result.issueId
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error: ' + err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
