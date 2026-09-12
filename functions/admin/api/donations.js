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
    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const tx_ref = (body.tx_ref || '').toString();
      const action = (body.action || 'confirm').toString();
      if (!tx_ref) {
        return new Response(JSON.stringify({ status: 'error', message: 'tx_ref is required' }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        });
      }
      const row = await env.DB.prepare('SELECT * FROM donations WHERE tx_ref = ?').bind(tx_ref).first();
      if (!row) {
        return new Response(JSON.stringify({ status: 'error', message: 'Donation not found' }), {
          status: 404, headers: { 'Content-Type': 'application/json' }
        });
      }
      if (action === 'confirm') {
        await env.DB.prepare(
          "UPDATE donations SET status = 'successful' WHERE tx_ref = ?"
        ).bind(tx_ref).run();
        return new Response(JSON.stringify({ status: 'ok', message: 'Donation confirmed' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ status: 'error', message: 'Unknown action' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
