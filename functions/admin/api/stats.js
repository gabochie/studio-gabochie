function json(r, status) {
  return new Response(JSON.stringify(r), {
    status: status || 200, headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: 'D1 not bound' }, 501);
  const referer = request.headers.get('Referer') || '';
  if (!referer.includes('/admin/')) return json({ error: 'Unauthorized' }, 403);

  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  try {
    if (request.method === 'GET') {
      if (id) {
        const row = await env.DB.prepare('SELECT * FROM stats WHERE id = ?').bind(id).first();
        return json(row || null);
      }
      const { results } = await env.DB.prepare(
        'SELECT * FROM stats WHERE active = 1 ORDER BY sort_order ASC'
      ).all();
      return json({ status: 'ok', count: results.length, items: results });
    }

    if (request.method === 'POST') {
      const body = await request.json();
      const { label, value, icon, sort_order } = body;
      if (!label || !value) return json({ error: 'label and value required' }, 400);
      const { results } = await env.DB.prepare(
        `INSERT INTO stats (label, value, icon, sort_order) VALUES (?, ?, ?, ?) RETURNING *`
      ).bind(label, value, icon || '', sort_order || 0).all();
      return json(results[0], 201);
    }

    if (request.method === 'PUT' && id) {
      const body = await request.json();
      const { label, value, icon, sort_order, active } = body;
      await env.DB.prepare(
        `UPDATE stats SET label = ?, value = ?, icon = ?, sort_order = ?, active = ?, updated_at = datetime('now') WHERE id = ?`
      ).bind(label, value, icon || '', sort_order || 0, active !== undefined ? (active ? 1 : 0) : 1, id).run();
      return json({ status: 'ok', updated: id });
    }

    if (request.method === 'DELETE' && id) {
      await env.DB.prepare('DELETE FROM stats WHERE id = ?').bind(id).run();
      return json({ status: 'ok', deleted: id });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err) {
    return json({ status: 'error', message: err.message }, 500);
  }
}
