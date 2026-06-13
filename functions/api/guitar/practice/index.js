import { getUser, json } from '../_utils.js';

export async function onRequest(context) {
  const db = context.env.DB;
  const req = context.request;
  const user = await getUser(context);
  if (!user) return json({error:'Auth required'}, 401);
  const url = new URL(req.url);

  if (url.pathname === '/api/guitar/practice' && req.method === 'POST') {
    const {duration_min, drill_type, drill_config, score, xp_earned, notes} = await req.json();
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const prevStats = await db.prepare('SELECT * FROM guitar_user_stats WHERE user_id = ?').bind(user.id).first();
    const prevStreak = prevStats?.streak || 0;
    const prevLastDate = prevStats?.last_practice_date || null;

    let newStreak = prevStreak;
    if (prevLastDate === today) {
    } else if (prevLastDate === yesterday) {
      newStreak = prevStreak + 1;
    } else {
      newStreak = 1;
    }

    await db.prepare(
      `INSERT INTO guitar_practice_sessions (user_id, date, duration_min, drill_type, drill_config, score, xp_earned, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(user.id, today, duration_min||0, drill_type||'', JSON.stringify(drill_config||{}), score||0, xp_earned||0, notes||'').run();

    await db.prepare(
      `INSERT INTO guitar_user_stats (user_id, total_xp, total_practice_min, total_sessions, last_practice_date, streak, updated_at)
       VALUES (?, ?, ?, 1, ?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         total_xp = total_xp + ?,
         total_practice_min = total_practice_min + ?,
         total_sessions = total_sessions + 1,
         last_practice_date = ?,
         streak = ?,
         updated_at = datetime('now')`
    ).bind(user.id, xp_earned||0, duration_min||0, today, newStreak, xp_earned||0, duration_min||0, today, newStreak).run();

    const stats = await db.prepare('SELECT * FROM guitar_user_stats WHERE user_id = ?').bind(user.id).first();
    const newLevel = Math.floor(Math.sqrt(stats.total_xp / 50)) + 1;
    if (newLevel > stats.level) {
      await db.prepare('UPDATE guitar_user_stats SET level = ? WHERE user_id = ?').bind(newLevel, user.id).run();
    }

    return json({ok:true, xp_earned, stats});
  }

  return json({error:'Not found'}, 404);
}
