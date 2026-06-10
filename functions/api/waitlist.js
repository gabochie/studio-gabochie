export async function onRequest(context) {
  var { request, env } = context;
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }
  var db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    var body = await request.json();
    var programSlug = (body.program_slug || '').trim();
    var name = (body.name || '').trim();
    var email = (body.email || '').trim().toLowerCase();
    var phone = (body.phone || '').trim();

    if (!programSlug || !email) {
      return new Response(JSON.stringify({ status: 'error', message: 'Missing program_slug or email' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    await db.prepare(
      'INSERT OR IGNORE INTO program_waitlist (program_slug, name, email, phone) VALUES (?, ?, ?, ?)'
    ).bind(programSlug, name, email, phone).run();

    return new Response(JSON.stringify({ status: 'ok', message: 'You\'re on the list!' }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
