import { processEmailQueue } from './_process-queue.js';
import { requireAdmin } from '../../admin/_auth.js';

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequest(context) {
  const { request, env } = context;

  // Admin-only: this endpoint lists the queue (recipient PII) and can trigger
  // real sends, so it must never be anonymously reachable.
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  if (!env.DB) return json({ error: 'D1 not bound' }, 501);

  try {
    const url = new URL(request.url);

    // List mode — preview the queue for the admin dashboard.
    if (url.searchParams.get('list')) {
      const { results } = await env.DB.prepare(
        "SELECT * FROM email_queue WHERE sent_at IS NULL AND scheduled_at <= datetime('now') ORDER BY scheduled_at ASC LIMIT 20"
      ).all();
      return json({ status: 'ok', count: results.length, items: results });
    }

    // Mark-sent mode — for an external sender that delivered the message itself.
    var markId = url.searchParams.get('mark_sent');
    if (markId) {
      await env.DB.prepare(
        "UPDATE email_queue SET sent_at = datetime('now'), status = 'sent' WHERE id = ? AND sent_at IS NULL"
      ).bind(parseInt(markId)).run();
      return json({ status: 'ok', marked: parseInt(markId) });
    }

    // Process mode — drain due emails through the shared processor.
    const summary = await processEmailQueue(env, env.DB);
    return json({ status: 'ok', sent: summary.sent, pending: summary.pending, failed: summary.failed });
  } catch (_err) {
    return json({ status: 'error', message: 'Internal error' }, 500);
  }
}
