import { getUser, json } from '../_utils.js';

export async function onRequest(context) {
  const db = context.env.DB;
  const req = context.request;
  const user = await getUser(context);
  if (!user) return json({error:'Auth required'}, 401);
  const url = new URL(req.url);
  const days = parseInt(url.searchParams.get('days') || '7');
  const {results} = await db.prepare("SELECT date, SUM(duration_min) as total_min, COUNT(*) as sessions, SUM(xp_earned) as total_xp FROM guitar_practice_sessions WHERE user_id = ? AND date >= datetime('now', ? || ' days') GROUP BY date ORDER BY date DESC").bind(user.id, `-${days}`).all();
  return json({sessions: results});
}
