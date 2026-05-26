export async function onRequest(context) {
  var { request, env } = context;
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  }
  var db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: 'D1 not bound' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }
  var url = new URL(request.url);
  var code = (url.searchParams.get('code') || '').trim().toUpperCase();
  if (!code) {
    return new Response(JSON.stringify({ status: 'error', message: 'Missing certificate code' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
    var cert = await db.prepare(
      'SELECT student_name, student_email, program_title, program_slug, certificate_code, issued_at FROM certificates WHERE certificate_code = ?'
    ).bind(code).first();
    if (!cert) {
      return new Response(JSON.stringify({ status: 'error', message: 'Certificate not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ status: 'ok', certificate: cert }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
