import { getUser, json } from '../_utils.js';

export async function onRequest(context) {
  const db = context.env.DB;
  const req = context.request;
  const user = await getUser(context);
  if (!user) return json({error:'Auth required'}, 401);
  const url = new URL(req.url);

  if (url.pathname === '/api/guitar/progress' && req.method === 'GET') {
    const {results: progress} = await db.prepare(
      'SELECT lesson_id, completed, xp, completed_at FROM guitar_progress WHERE user_id = ?'
    ).bind(user.id).all();
    const stats = await db.prepare('SELECT * FROM guitar_user_stats WHERE user_id = ?').bind(user.id).first() || {total_xp:0, level:1, streak:0, total_practice_min:0, total_sessions:0};
    const {results: badges} = await db.prepare(
      `SELECT ga.*, gua.earned_at FROM guitar_user_achievements gua
       JOIN guitar_achievements ga ON ga.key = gua.achievement_key
       WHERE gua.user_id = ?`
    ).bind(user.id).all();
    const {results: allBadges} = await db.prepare('SELECT * FROM guitar_achievements ORDER BY tier').all();
    const {results: recentSessions} = await db.prepare(
      'SELECT * FROM guitar_practice_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 10'
    ).bind(user.id).all();
    return json({progress, stats, badges, allBadges, recentSessions});
  }

  if (url.pathname === '/api/guitar/progress' && req.method === 'POST') {
    const {lesson_id, action} = await req.json();
    if (action === 'complete') {
      await db.prepare(
        `INSERT INTO guitar_progress (user_id, lesson_id, completed, xp, completed_at)
         VALUES (?, ?, 1, 10, datetime('now'))
         ON CONFLICT(user_id, lesson_id) DO UPDATE SET completed=1, completed_at=datetime('now')`
      ).bind(user.id, lesson_id).run();
      await db.prepare(
        `INSERT INTO guitar_user_stats (user_id, total_xp, updated_at)
         VALUES (?, 10, datetime('now'))
         ON CONFLICT(user_id) DO UPDATE SET total_xp = total_xp + 10, updated_at = datetime('now')`
      ).bind(user.id).run();
      const stats = await db.prepare('SELECT * FROM guitar_user_stats WHERE user_id = ?').bind(user.id).first();
      const newLevel = Math.floor(Math.sqrt(stats.total_xp / 50)) + 1;
      if (newLevel > stats.level) {
        await db.prepare('UPDATE guitar_user_stats SET level = ? WHERE user_id = ?').bind(newLevel, user.id).run();
        stats.level = newLevel;
      }
      return json({ok:true, xpEarned:10, stats});
    }
    if (action === 'uncomplete') {
      await db.prepare('UPDATE guitar_progress SET completed=0, completed_at=NULL WHERE user_id=? AND lesson_id=?').bind(user.id, lesson_id).run();
      return json({ok:true});
    }
    return json({error:'Invalid action'}, 400);
  }

  return json({error:'Not found'}, 404);
}
