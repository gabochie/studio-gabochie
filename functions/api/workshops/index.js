export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), { status: 501, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get('slug');
    if (slug) {
      const workshop = await db.prepare(
        `SELECT id, title, slug, description, date, time, location, price, capacity, image_url, status, created_at FROM workshops WHERE slug = ? AND status = 'published'`
      ).bind(slug).first();
      if (!workshop) {
        return new Response(JSON.stringify({ status: 'error', message: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }
      const count = await db.prepare('SELECT COUNT(*) as cnt FROM workshop_registrations WHERE workshop_id = ? AND status = \'registered\'').bind(workshop.id).first();
      workshop.registered = count ? count.cnt : 0;
      return new Response(JSON.stringify({ status: 'ok', workshop }), { headers: { 'Content-Type': 'application/json' } });
    }
    const workshops = await db.prepare(
      `SELECT id, title, slug, description, date, time, location, price, capacity, image_url, created_at FROM workshops WHERE status = 'published' ORDER BY date ASC`
    ).all();
    for (const w of workshops.results) {
      const count = await db.prepare('SELECT COUNT(*) as cnt FROM workshop_registrations WHERE workshop_id = ? AND status = \'registered\'').bind(w.id).first();
      w.registered = count ? count.cnt : 0;
    }
    return new Response(JSON.stringify({ status: 'ok', workshops: workshops.results }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
