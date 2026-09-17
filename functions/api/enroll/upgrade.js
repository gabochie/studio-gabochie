import { getToken, getSessionUser } from './_token.js';

async function verifyFlutterwave(env, transactionId, txRef, expectedAmount) {
  var key = env.FLW_SECRET_KEY;
  if (!key) return { ok: false, code: 'NO_KEY' };
  var res = await fetch('https://api.flutterwave.com/v3/transactions/' + encodeURIComponent(transactionId) + '/verify', {
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }
  });
  if (!res.ok) return { ok: false, code: 'FLW_HTTP_' + res.status };
  var data = await res.json();
  if (!data || data.status !== 'success' || !data.data) return { ok: false, code: 'VERIFY_FAILED' };
  var t = data.data;
  if (t.status !== 'successful') return { ok: false, code: 'PAYMENT_OPEN' };
  if (txRef && t.tx_ref && t.tx_ref !== txRef) return { ok: false, code: 'TX_REF_MISMATCH' };
  if (expectedAmount != null && t.amount != null && Math.round(Number(t.amount)) !== Math.round(Number(expectedAmount))) return { ok: false, code: 'AMOUNT_MISMATCH' };
  if (t.currency && t.currency !== 'GHS') return { ok: false, code: 'CURRENCY_MISMATCH' };
  return { ok: true };
}

export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };
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
    var token = getToken(request, body);
    var tx_ref = (body.tx_ref || '').trim();
    var transaction_id = (body.transaction_id || '').trim();
    if (!token) {
      return new Response(JSON.stringify({ status: 'error', message: 'Missing token' }), {
        status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    var enrollment = await db.prepare(
      'SELECT e.id, e.status, p.price, p.full_content FROM enrollments e JOIN programs p ON e.program_id = p.id WHERE e.access_token = ?'
    ).bind(token).first();
    if (!enrollment) {
      var session = await getSessionUser(db, token);
      if (session) {
        enrollment = await db.prepare(
          'SELECT e.id, e.status, p.price, p.full_content FROM enrollments e JOIN programs p ON e.program_id = p.id WHERE e.user_id = ? ORDER BY e.enrolled_at DESC LIMIT 1'
        ).bind(session.user_id).first();
        if (!enrollment) {
          enrollment = await db.prepare(
            'SELECT e.id, e.status, p.price, p.full_content FROM enrollments e JOIN programs p ON e.program_id = p.id WHERE e.student_email = ? ORDER BY e.enrolled_at DESC LIMIT 1'
          ).bind(session.email).first();
        }
      }
    }
    if (!enrollment) {
      return new Response(JSON.stringify({ status: 'error', message: 'Invalid token' }), {
        status: 404, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    if (enrollment.status === 'active') {
      return new Response(JSON.stringify({ status: 'ok', message: 'Already upgraded' }), {
        headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    var price = enrollment.price == null ? 0 : Number(enrollment.price);
    if (price > 0) {
      if (!transaction_id) {
        return new Response(JSON.stringify({ status: 'error', message: 'Payment verification required', code: 'MISSING_TX' }), {
          status: 402, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
        });
      }
      var verified = await verifyFlutterwave(env, transaction_id, tx_ref || '', price);
      if (!verified.ok) {
        return new Response(JSON.stringify({ status: 'error', message: 'Payment could not be verified', code: verified.code }), {
          status: 402, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
        });
      }
    }
    var payment = tx_ref || transaction_id || '';
    await db.prepare(
      `UPDATE enrollments SET status = ?, payment_ref = COALESCE(NULLIF(?, ''), payment_ref) WHERE id = ?`
    ).bind('active', payment, enrollment.id).run();
    return new Response(JSON.stringify({
      status: 'ok',
      message: 'Upgraded to full access',
      full_content: enrollment.full_content || ''
    }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  }
}
