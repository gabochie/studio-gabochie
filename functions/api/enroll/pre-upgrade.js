export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  var db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  }
  try {
    var body = await request.json();
    var token = (body.token || '').trim();
    if (!token) {
      return new Response(JSON.stringify({ status: 'error', message: 'Missing token' }), {
        status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    var enrollment = await db.prepare(
      'SELECT e.id, e.status, p.price FROM enrollments e JOIN programs p ON e.program_id = p.id WHERE e.access_token = ?'
    ).bind(token).first();
    if (!enrollment) {
      return new Response(JSON.stringify({ status: 'error', message: 'Invalid token' }), {
        status: 404, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    if (enrollment.status === 'active') {
      return new Response(JSON.stringify({ status: 'ok', tx_ref: '', price: enrollment.price, message: 'Already upgraded' }), {
        headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    var tx_ref = 'upgrade_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    await db.prepare(
      'UPDATE enrollments SET payment_ref = ? WHERE id = ? AND status = ?'
    ).bind(tx_ref, enrollment.id, 'sample').run();
    return new Response(JSON.stringify({ status: 'ok', tx_ref: tx_ref, price: enrollment.price }), {
      headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  }
}
