export async function onRequest(context) {
  const db = context.env.DB;
  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    const body = await context.request.json();
    const { email, contentSlug, platform } = body;
    if (!email || !contentSlug) {
      return new Response(JSON.stringify({ error: 'Email and content slug required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    try {
      await db.prepare('INSERT INTO share_unlocks (email, content_slug, share_platform) VALUES (?, ?, ?)')
        .bind(email, contentSlug, platform || '').run();
    } catch (e) {
      if (e.message && e.message.includes('UNIQUE')) {
        return new Response(JSON.stringify({ ok: true, already_unlocked: true }), { headers: { 'Content-Type': 'application/json' } });
      }
      throw e;
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}