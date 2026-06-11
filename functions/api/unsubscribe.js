export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'GET' && request.method !== 'POST') {
    return new Response(JSON.stringify({ status: 'error', message: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...cors } });
  }

  try {
    var email = '';
    if (request.method === 'GET') {
      var url = new URL(request.url);
      email = url.searchParams.get('email') || '';
    } else {
      var body = await request.json();
      email = (body && body.email) || '';
    }

    email = email.toLowerCase().trim();
    if (!email) {
      return new Response(JSON.stringify({ status: 'error', message: 'Email is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
    }

    var db = env.DB;
    var sub = await db.prepare("SELECT id, name, confirmed, brevo_id FROM subscribers WHERE email = ?").bind(email).first();
    if (!sub) {
      return new Response(JSON.stringify({ status: 'ok', message: 'Email not found in our list — you\'re already unsubscribed.' }), { headers: { 'Content-Type': 'application/json', ...cors } });
    }

    if (sub.confirmed === 0) {
      return new Response(JSON.stringify({ status: 'ok', message: 'You are already unsubscribed.' }), { headers: { 'Content-Type': 'application/json', ...cors } });
    }

    // Mark as unsubscribed in D1
    await db.prepare("UPDATE subscribers SET confirmed = 0 WHERE id = ?").bind(sub.id).run();

    // Remove from Brevo list if we have a brevo_id
    if (sub.brevo_id && env.BREVO_API_KEY) {
      try {
        await fetch('https://api.brevo.com/v3/contacts/' + encodeURIComponent(sub.brevo_id), {
          method: 'DELETE',
          headers: { 'api-key': env.BREVO_API_KEY }
        });
      } catch (_e) {}
    }

    return new Response(JSON.stringify({ status: 'ok', message: 'You have been unsubscribed successfully.' }), { headers: { 'Content-Type': 'application/json', ...cors } });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
