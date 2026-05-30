import { sendBrevoEmail } from './_send.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    const url = new URL(request.url);

    // List mode — return the full queue
    if (url.searchParams.get('list')) {
      const { results } = await env.DB.prepare(
        'SELECT * FROM email_queue ORDER BY scheduled_at DESC LIMIT 100'
      ).all();
      return new Response(JSON.stringify({ status: 'ok', count: results.length, items: results }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Process mode — send due emails
    const { results } = await env.DB.prepare(
      "SELECT * FROM email_queue WHERE sent_at IS NULL AND scheduled_at <= datetime('now') ORDER BY scheduled_at ASC LIMIT 20"
    ).all();

    let sent = 0;
    for (const row of results) {
      await sendBrevoEmail(env, row.to_email, row.to_name, row.subject, row.html_content);
      await env.DB.prepare('UPDATE email_queue SET sent_at = datetime(\'now\') WHERE id = ?').bind(row.id).run();
      sent++;
    }

    return new Response(JSON.stringify({ status: 'ok', sent, pending: results.length - sent }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
