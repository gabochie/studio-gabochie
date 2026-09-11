export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ status: 'error', message: 'Method not allowed' }), {
      status: 405, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  }
  try {
    var body = await request.json();
    var token = body.token || '';
    if (token && env.DB) {
      await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    }
    return new Response(JSON.stringify({ status: 'ok' }), {
      headers: Object.assign({ 'Content-Type': 'application/json', 'Set-Cookie': 'ga_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.gabochie.com; HttpOnly; Secure; SameSite=Lax' }, cors)
    });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'ok' }), {
      headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  }
}
