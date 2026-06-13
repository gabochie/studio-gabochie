import { getUser, json } from './_utils.js';

export async function onRequest(context) {
  const db = context.env.DB;
  const req = context.request;
  const user = await getUser(context);

  if (req.method === 'GET') {
    let earned = [];
    if (user) {
      const {results} = await db.prepare('SELECT achievement_key FROM guitar_user_achievements WHERE user_id = ?').bind(user.id).all();
      earned = results.map(r => r.achievement_key);
    }
    const {results: all} = await db.prepare('SELECT * FROM guitar_achievements ORDER BY tier, key').all();
    return json({achievements: all.map(a => ({...a, earned: earned.includes(a.key)}))});
  }

  if (req.method === 'POST') {
    if (!user) return json({error:'Auth required'}, 401);
    const {key} = await req.json();
    const ach = await db.prepare('SELECT * FROM guitar_achievements WHERE key = ?').bind(key).first();
    if (!ach) return json({error:'Achievement not found'}, 404);
    const existing = await db.prepare('SELECT id FROM guitar_user_achievements WHERE user_id = ? AND achievement_key = ?').bind(user.id, key).first();
    if (existing) return json({ok:true, already:true});
    await db.prepare('INSERT INTO guitar_user_achievements (user_id, achievement_key) VALUES (?, ?)').bind(user.id, key).run();
    await db.prepare('UPDATE guitar_user_stats SET total_xp = total_xp + 50 WHERE user_id = ?').bind(user.id).run();
    return json({ok:true, xpBonus: 50, achievement: ach});
  }

  return json({error:'Method not allowed'}, 405);
}
