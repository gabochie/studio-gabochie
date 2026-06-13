import { getUser, json } from '../_utils.js';

export async function onRequest(context) {
  const db = context.env.DB;
  const user = await getUser(context);
  const id = context.params.id;

  const mod = await db.prepare('SELECT * FROM guitar_modules WHERE id = ?').bind(id).first();
  if (!mod) return json({error:'Not found'}, 404);
  const {results: lessons} = await db.prepare(
    'SELECT * FROM guitar_lessons WHERE module_id = ? ORDER BY sort_order'
  ).bind(id).all();
  let progress = {};
  if (user) {
    const ids = lessons.map(l => l.id);
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      const {results: prog} = await db.prepare(
        `SELECT lesson_id, completed, xp FROM guitar_progress WHERE user_id = ? AND lesson_id IN (${placeholders})`
      ).bind(user.id, ...ids).all();
      prog.forEach(p => progress[p.lesson_id] = p);
    }
  }
  return json({module: mod, lessons, progress});
}
