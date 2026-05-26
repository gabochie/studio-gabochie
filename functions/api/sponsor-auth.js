export async function onRequest(context) {
  const db = context.env.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: { 'Content-Type': 'application/json' } });
  }

  const url = new URL(context.request.url);

  // GET — verify session token
  if (context.request.method === 'GET') {
    const token = url.searchParams.get('token');
    if (!token) {
      return new Response(JSON.stringify({ authed: false }), { headers: { 'Content-Type': 'application/json' } });
    }

    const session = await db.prepare(
      'SELECT s.email, sp.company FROM sponsor_sessions s JOIN sponsors sp ON s.email = sp.email WHERE s.token = ? AND s.expires_at > datetime(\'now\') AND sp.status = \'active\''
    ).bind(token).first();

    if (!session) {
      return new Response(JSON.stringify({ authed: false }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ authed: true, email: session.email, company: session.company }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // POST — login with email + access code (or logout)
  if (context.request.method === 'POST') {
    let body;
    try { body = await context.request.json(); } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Logout
    if (body.action === 'logout' && body.token) {
      await db.prepare('DELETE FROM sponsor_sessions WHERE token = ?').bind(body.token).run();
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }


    const { email, code } = body;
    if (!email || !code) {
      return new Response(JSON.stringify({ error: 'Email and access code required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const sponsor = await db.prepare(
      'SELECT id, email, company FROM sponsors WHERE email = ? AND access_code = ? AND status = \'active\''
    ).bind(email.trim().toLowerCase(), code.trim()).first();

    if (!sponsor) {
      return new Response(JSON.stringify({ error: 'Invalid email or access code' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    // Generate session token (expires in 30 days)
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await db.prepare(
      'INSERT INTO sponsor_sessions (email, token, expires_at) VALUES (?, ?, ?)'
    ).bind(sponsor.email, token, expiresAt).run();

    // Clean up old sessions for this sponsor
    await db.prepare(
      'DELETE FROM sponsor_sessions WHERE email = ? AND expires_at <= datetime(\'now\')'
    ).bind(sponsor.email).run();

    return new Response(JSON.stringify({ authed: true, token, email: sponsor.email, company: sponsor.company }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response('Method not allowed', { status: 405 });
}
