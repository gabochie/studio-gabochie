import { requireAdmin } from '../../_auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const authErr = requireAdmin(request, env);
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

    // If test_email is set, send a test only
    if (test_email) {
      const rendered = html
        .replace(/\{\{NAME\}\}/g, 'Gideon')
        .replace(/\{\{REF_CODE\}\}/g, 'GA-TEST')
        .replace(/\{\{EDITION\}\}/g, 'GH');
      const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
        body: JSON.stringify({
          sender: { name: 'GideonAbochie Studio', email: 'newsletter@gideonabochie.org' },
          to: [{ email: test_email }],
          subject: '[TEST] ' + subject,
          htmlContent: rendered
        })
      });
      if (!resp.ok) {
        const errData = await resp.text();
        return new Response(JSON.stringify({ status: 'error', message: 'Brevo returned ' + resp.status + ': ' + errData }), { headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ status: 'ok', message: 'Test sent to ' + test_email }), { headers: { 'Content-Type': 'application/json' } });
    }

    // Broadcast: send to all subscribers via Brevo SMTP (batched)
    const subs = await env.DB.prepare("SELECT email, name FROM subscribers WHERE email != ''").all();
    const subscribers = subs.results || [];
    if (subscribers.length === 0) {
      return new Response(JSON.stringify({ status: 'error', message: 'No subscribers to send to' }), { headers: { 'Content-Type': 'application/json' } });
    }

    // Send to all subscribers via Brevo SMTP (up to 100 per batch to avoid API limits)
    const batchSize = 100;
    let sent = 0;
    let failed = 0;
    for (let i = 0; i < subscribers.length; i += batchSize) {
      const batch = subscribers.slice(i, i + batchSize);
      const toList = batch.map(s => ({ email: s.email, name: s.name || s.email }));
      const rendered = html
        .replace(/\{\{NAME\}\}/g, 'Friend')
        .replace(/\{\{REF_CODE\}\}/g, '')
        .replace(/\{\{EDITION\}\}/g, 'GH');
      try {
        const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
          body: JSON.stringify({
            sender: { name: 'GideonAbochie Studio', email: 'newsletter@gideonabochie.org' },
            to: toList,
            subject: subject,
            htmlContent: rendered
          })
        });
        if (resp.ok) {
          sent += batch.length;
        } else {
          failed += batch.length;
        }
      } catch (_e) {
        failed += batch.length;
      }
    }

    // Archive issue
    const row = await env.DB.prepare("SELECT COALESCE(MAX(issue_number), 0) + 1 AS next_num FROM newsletter_issues").first();
    const issueNumber = row ? row.next_num : 1;
    await env.DB.prepare(
      "INSERT INTO newsletter_issues (issue_number, subject, theme, html, subscriber_count) VALUES (?, ?, ?, ?, ?)"
    ).bind(issueNumber, subject, theme || '', html, subscribers.length).run();

    return new Response(JSON.stringify({
      status: 'ok', message: `Sent to ${sent} subscribers (${failed} failed)`, sent, failed, total: subscribers.length, issue_number: issueNumber
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
