export async function onRequest(context) {
  var { request, env } = context;
  var db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    var body = await request.json();
    var { token, tx_ref, amount } = body;

    if (!token || !tx_ref) {
      return new Response(JSON.stringify({ status: 'error', message: 'Missing token or tx_ref' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    var enrollment = await db.prepare(
      'SELECT e.id, e.status, p.id as program_id, p.full_content FROM enrollments e JOIN programs p ON e.program_id = p.id WHERE e.access_token = ?'
    ).bind(token).first();

    if (!enrollment) {
      return new Response(JSON.stringify({ status: 'error', message: 'Invalid token' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      });
    }

    if (enrollment.status === 'active') {
      return new Response(JSON.stringify({ status: 'ok', message: 'Already upgraded' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await db.prepare(
      'UPDATE enrollments SET status = ?, payment_ref = ?, payment_amount = ? WHERE id = ?'
    ).bind('active', tx_ref, amount || 0, enrollment.id).run();

    return new Response(JSON.stringify({
      status: 'ok',
      message: 'Upgraded to full access',
      full_content: enrollment.full_content || ''
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
