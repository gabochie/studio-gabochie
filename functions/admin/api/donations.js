import { requireAdmin } from '../_auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;
  try {
    if (request.method === 'GET') {
      const { results } = await env.DB.prepare(
        "SELECT * FROM donations ORDER BY created_at DESC"
      ).all();
      const totals = await env.DB.prepare(
        "SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total, COALESCE(SUM(CASE WHEN status = 'successful' THEN amount ELSE 0 END), 0) AS total_successful FROM donations"
      ).first();
      return new Response(JSON.stringify({ status: 'ok', count: results.length, items: results, totals }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
