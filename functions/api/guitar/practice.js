export async function onRequest(context) {
  const db = context.env.DB;
  const req = context.request;
  const user = await getUser(context);
  if (!user) return json({error:'Auth required'}, 401);
  const url = new URL(req.url);

  if (url.pathname === '/api/guitar/practice' && req.method === 'POST') {
    const {duration_min, drill_type, drill_config, score, xp_earned, notes} = await req.json();
    const today = new Date().toISOString().split('T')[0];
    await db.prepare(
      `INSERT INTO guitar_practice_sessions (user_id, date, duration_min, drill_type, drill_config, score, xp_earned, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(user.id, today, duration_min||0, drill_type||'', JSON.stringify(drill_config||{}), score||0, xp_earned||0, notes||'').run();

    await db.prepare(
      `INSERT INTO guitar_user_stats (user_id, total_xp, total_practice_min, total_sessions, last_practice_date, updated_at)
       VALUES (?, ?, ?, 1, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         total_xp = total_xp + ?,
         total_practice_min = total_practice_min + ?,
         total_sessions = total_sessions + 1,
         last_practice_date = ?,
         updated_at = datetime('now')`
    ).bind(user.id, xp_earned||0, duration_min||0, today, xp_earned||0, duration_min||0, today).run();

    const stats = await db.prepare('SELECT * FROM guitar_user_stats WHERE user_id = ?').bind(user.id).first();
    const newLevel = Math.floor(Math.sqrt(stats.total_xp / 50)) + 1;
    if (newLevel > stats.level) {
      await db.prepare('UPDATE guitar_user_stats SET level = ? WHERE user_id = ?').bind(newLevel, user.id).run();
    }

    if (stats.last_practice_date === today && stats.streak === 0) {
      await db.prepare('UPDATE guitar_user_stats SET streak = 1 WHERE user_id = ?').bind(user.id).run();
    }
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (stats.last_practice_date === yesterday || !stats.last_practice_date) {
      const newStreak = (stats.streak || 0) + 1;
      await db.prepare('UPDATE guitar_user_stats SET streak = ? WHERE user_id = ?').bind(newStreak, user.id).run();
    }

    return json({ok:true, xpEarned, stats});
  }

  if (url.pathname === '/api/guitar/practice/records' && req.method === 'POST') {
    const {chord_pair, score} = await req.json();
    await db.prepare(
      'INSERT INTO guitar_one_minute_records (user_id, chord_pair, score) VALUES (?, ?, ?)'
    ).bind(user.id, chord_pair, score).run();
    return json({ok:true});
  }

  if (url.pathname === '/api/guitar/practice/records' && req.method === 'GET') {
    const {results} = await db.prepare(
      'SELECT chord_pair, MAX(score) as best_score FROM guitar_one_minute_records WHERE user_id = ? GROUP BY chord_pair ORDER BY chord_pair'
    ).bind(user.id).all();
    return json({records: results});
  }

  if (url.pathname === '/api/guitar/practice/sessions' && req.method === 'GET') {
    const days = parseInt(url.searchParams.get('days') || '7');
    const {results} = await db.prepare(
      'SELECT date, SUM(duration_min) as total_min, COUNT(*) as sessions, SUM(xp_earned) as total_xp FROM guitar_practice_sessions WHERE user_id = ? AND date >= datetime("now", ? || " days") GROUP BY date ORDER BY date DESC'
    ).bind(user.id, `-${days}`).all();
    return json({sessions: results});
  }

  return json({error:'Not found'}, 404);
}

async function getUser(ctx) {
  const auth = ctx.request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const session = await ctx.env.DB.prepare('SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime("now")').bind(token).first();
  if (!session) return null;
  return await ctx.env.DB.prepare('SELECT id, email, name FROM users WHERE id = ?').bind(session.user_id).first();
}
function json(d, s=200) { return new Response(JSON.stringify(d), {status:s, headers:{'Content-Type':'application/json'}}); }
