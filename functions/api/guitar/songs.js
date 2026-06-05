export async function onRequest(context) {
  const db = context.env.DB;
  const req = context.request;
  const url = new URL(req.url);
  const user = await getUser(context);

  if (url.pathname === '/api/guitar/songs' && req.method === 'GET') {
    const {results} = await db.prepare(
      'SELECT * FROM guitar_songs ORDER BY difficulty, title'
    ).all();
    return json({songs: results});
  }

  if (url.pathname.match(/^\/api\/guitar\/songs\/(\d+)$/) && req.method === 'GET') {
    const id = url.pathname.split('/').pop();
    const song = await db.prepare('SELECT * FROM guitar_songs WHERE id = ?').bind(id).first();
    if (!song) return json({error:'Not found'}, 404);
    return json({song});
  }

  if (url.pathname === '/api/guitar/achievements' && req.method === 'GET') {
    let earned = [];
    if (user) {
      const {results} = await db.prepare(
        'SELECT achievement_key FROM guitar_user_achievements WHERE user_id = ?'
      ).bind(user.id).all();
      earned = results.map(r => r.achievement_key);
    }
    const {results: all} = await db.prepare('SELECT * FROM guitar_achievements ORDER BY tier, key').all();
    return json({achievements: all.map(a => ({...a, earned: earned.includes(a.key)}))});
  }

  if (url.pathname === '/api/guitar/achievements' && req.method === 'POST') {
    if (!user) return json({error:'Auth required'}, 401);
    const {key} = await req.json();
    const ach = await db.prepare('SELECT * FROM guitar_achievements WHERE key = ?').bind(key).first();
    if (!ach) return json({error:'Achievement not found'}, 404);
    const existing = await db.prepare(
      'SELECT id FROM guitar_user_achievements WHERE user_id = ? AND achievement_key = ?'
    ).bind(user.id, key).first();
    if (existing) return json({ok:true, already:true});
    await db.prepare(
      'INSERT INTO guitar_user_achievements (user_id, achievement_key) VALUES (?, ?)'
    ).bind(user.id, key).run();
    // XP bonus for earning achievement
    await db.prepare(
      'UPDATE guitar_user_stats SET total_xp = total_xp + 50 WHERE user_id = ?'
    ).bind(user.id).run();
    return json({ok:true, xpBonus: 50, achievement: ach});
  }

  if (url.pathname === '/api/guitar/leaderboard' && req.method === 'GET') {
    const period = url.searchParams.get('period') || 'weekly';
    let dateFilter = '';
    if (period === 'weekly') dateFilter = "AND ps.date >= datetime('now', '-7 days')";
    else if (period === 'monthly') dateFilter = "AND ps.date >= datetime('now', '-30 days')";
    else dateFilter = '';
    const {results} = await db.prepare(`
      SELECT u.name, u.email, COALESCE(s.total_xp,0) as xp, COALESCE(s.level,1) as level,
        COALESCE(s.streak,0) as streak, COALESCE(s.total_practice_min,0) as minutes,
        (SELECT COUNT(*) FROM guitar_user_achievements gua WHERE gua.user_id = u.id) as badges
      FROM users u
      LEFT JOIN guitar_user_stats s ON s.user_id = u.id
      WHERE s.total_xp > 0
      ORDER BY xp DESC LIMIT 50
    `).all();
    return json({leaderboard: results.map(r => ({
      ...r, isCurrentUser: user ? r.email === user.email : false, nickname: r.name
    }))});
  }

  if (url.pathname === '/api/guitar/enroll' && req.method === 'POST') {
    if (!user) return json({error:'Auth required'}, 401);
    const existing = await db.prepare(
      'SELECT id, status FROM guitar_payments WHERE user_id = ? ORDER BY id DESC LIMIT 1'
    ).bind(user.id).first();
    if (existing && existing.status === 'completed') {
      return json({ok:true, alreadyUnlocked: true});
    }
    const tx_ref = 'GUITAR_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
    await db.prepare(
      'INSERT INTO guitar_payments (user_id, email, status, flw_tx_ref, amount, plan) VALUES (?, ?, ?, ?, 99, ?)'
    ).bind(user.id, user.email, 'pending', tx_ref, 'full').run();
    return json({tx_ref, amount: 99, currency: 'GHS', message: 'Pay with Flutterwave to unlock all modules'});
  }

  if (url.pathname === '/api/guitar/enroll/status' && req.method === 'GET') {
    if (!user) return json({unlocked: false});
    const payment = await db.prepare(
      "SELECT status FROM guitar_payments WHERE user_id = ? AND status = 'completed' ORDER BY id DESC LIMIT 1"
    ).bind(user.id).first();
    return json({unlocked: !!payment, trialModules: 3});
  }

  if (url.pathname === '/api/guitar/enroll/webhook' && req.method === 'POST') {
    const data = await req.json();
    if (data.event === 'charge.completed' && data.data?.tx_ref?.startsWith('GUITAR_')) {
      await db.prepare(
        "UPDATE guitar_payments SET status = 'completed' WHERE flw_tx_ref = ?"
      ).bind(data.data.tx_ref).run();
    }
    return json({ok:true});
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
