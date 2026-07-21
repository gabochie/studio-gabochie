import { requireAdmin } from '../../_auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
    const { subject, body } = await request.json();
    if (!subject || !body) {
      return new Response(JSON.stringify({ status: 'error', message: 'subject and body required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    if (!env.BREVO_API_KEY) {
      return new Response(JSON.stringify({
        status: 'not_configured',
        message: 'BREVO_API_KEY not set. Add it in Cloudflare Pages env vars.'
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // Get admin email from subscriber #1 (the site owner)
    const admin = await env.DB.prepare(
      "SELECT email, name FROM subscribers ORDER BY id ASC LIMIT 1"
    ).first();
    const toEmail = admin ? admin.email : 'studio@gabochie.com';
    const toName = admin ? (admin.name || 'Gideon') : 'Gideon';

    const htmlContent = body
      .replace(/\{\{NAME\}\}/g, toName)
      .replace(/\{\{REF_CODE\}\}/g, 'GA-TEST')
      .replace(/\{\{EDITION\}\}/g, 'GH');

    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': env.BREVO_API_KEY
      },
      body: JSON.stringify({
        sender: { name: 'Gideon Abochie', email: 'newsletter@gabochie.com' },
        to: [{ email: toEmail, name: toName }],
        subject: '[TEST] ' + subject,
        htmlContent: htmlContent
      })
    });

    if (!resp.ok) {
      const errData = await resp.text();
      return new Response(JSON.stringify({
        status: 'error',
        message: 'Brevo returned ' + resp.status + ': ' + errData
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      status: 'ok',
      message: 'Test email sent to ' + toEmail
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
