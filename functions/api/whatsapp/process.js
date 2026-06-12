import { sendWhatsApp } from './_send.js';

export async function onRequest(context) {
  var { request, env } = context;
  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    var url = new URL(request.url);

    if (url.searchParams.get('list')) {
      var { results } = await env.DB.prepare(
        "SELECT * FROM whatsapp_queue WHERE status = 'pending' AND scheduled_at <= datetime('now') ORDER BY scheduled_at ASC LIMIT 20"
      ).all();
      return new Response(JSON.stringify({ status: 'ok', count: results.length, items: results }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    var markId = url.searchParams.get('mark_sent');
    if (markId) {
      await env.DB.prepare("UPDATE whatsapp_queue SET status = 'sent', sent_at = datetime('now') WHERE id = ? AND status = 'pending'").bind(parseInt(markId)).run();
      return new Response(JSON.stringify({ status: 'ok', marked: parseInt(markId) }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    var { results } = await env.DB.prepare(
      "SELECT * FROM whatsapp_queue WHERE status = 'pending' AND scheduled_at <= datetime('now') ORDER BY scheduled_at ASC LIMIT 20"
    ).all();

    var sent = 0;
    for (var row of results) {
      try {
        await sendWhatsApp(env, row.to_phone, row.message_text);
        await env.DB.prepare("UPDATE whatsapp_queue SET status = 'sent', sent_at = datetime('now') WHERE id = ?").bind(row.id).run();
        sent++;
      } catch (e) {
        await env.DB.prepare("UPDATE whatsapp_queue SET status = 'failed' WHERE id = ?").bind(row.id).run();
      }
    }

    return new Response(JSON.stringify({ status: 'ok', sent: sent, pending: results.length - sent }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
