function getToken(request) {
  var auth = request.headers.get('Authorization') || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  var url = new URL(request.url);
  return url.searchParams.get('token') || '';
}

export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ status: 'error', message: 'Method not allowed' }), {
      status: 405, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  }
  var db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  }
  try {
    var token = getToken(request);
    if (!token) {
      return new Response(JSON.stringify({ status: 'error', message: 'No session token' }), {
        status: 401, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    var session = await db.prepare(
      'SELECT s.user_id, s.expires_at, u.id, u.name, u.email, u.email_verified, u.created_at FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ?'
    ).bind(token).first();
    if (!session) {
      return new Response(JSON.stringify({ status: 'error', message: 'Invalid session' }), {
        status: 401, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    var now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    if (session.expires_at < now) {
      await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
      return new Response(JSON.stringify({ status: 'error', message: 'Session expired' }), {
        status: 401, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    return new Response(JSON.stringify({
      status: 'ok',
      user: { id: session.user_id, name: session.name, email: session.email, email_verified: session.email_verified, created_at: session.created_at }
    }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  }
}
