import { requireAdminAuth } from '../../_admin-auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'PUT, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;
  if (request.method !== 'PUT') return new Response(JSON.stringify({ error: 'PUT required' }), { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } });
  const db = env.DB;
  if (!db) return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: { ...cors, 'Content-Type': 'application/json' } });
  try {
    await db.prepare("CREATE TABLE IF NOT EXISTS guitar_lesson_videos (lesson_id INTEGER PRIMARY KEY, youtube_id TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
    const body = await request.json();
    const updates = Array.isArray(body) ? body : [body];
    let count = 0;
    for (const item of updates) {
      if (!item.lesson_id) continue;
      await db.prepare("INSERT INTO guitar_lesson_videos (lesson_id, youtube_id, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(lesson_id) DO UPDATE SET youtube_id = excluded.youtube_id, updated_at = datetime('now')").bind(item.lesson_id, item.youtube_id || '').run();
      count++;
    }
    return new Response(JSON.stringify({ status: 'ok', updated: count }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
}
