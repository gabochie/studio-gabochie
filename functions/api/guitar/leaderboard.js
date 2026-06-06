export async function onRequest(context) {
  const db = context.env.DB;
  const req = context.request;
  const user = await getUser(context);
  const url = new URL(req.url);
  const period = url.searchParams.get('period') || 'weekly';

  let dateFilter = '';
  if (period === 'weekly') dateFilter = "AND ps.date >= datetime('now', '-7 days')";
  else if (period === 'monthly') dateFilter = "AND ps.date >= datetime('now', '-30 days')";

  const {results} = await db.prepare(`
    SELECT u.name, u.email, COALESCE(s.total_xp,0) as xp, COALESCE(s.level,1) as level,
      COALESCE(s.streak,0) as streak, COALESCE(s.total_practice_min,0) as minutes,
      (SELECT COUNT(*) FROM guitar_user_achievements gua WHERE gua.user_id = u.id) as badges
    FROM users u
    LEFT JOIN guitar_user_stats s ON s.user_id = u.id
    WHERE s.total_xp > 0
    ORDER BY xp DESC LIMIT 50
  `).all();

  return json({leaderboard: results.map(r => ({...r, isCurrentUser: user ? r.email === user.email : false, nickname: r.name}))});
}

async function getUser(ctx) {
  const auth = ctx.request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const session = await ctx.env.DB.prepare('SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime("now")').bind(token).first();
  if (!session) return null;
  return await ctx.env.DB.prepare('SELECT id, email, name FROM users WHERE id = ?').bind(session.user_id).first();
}
function json(data, s=200) { return new Response(JSON.stringify(data), {status:s, headers:{'Content-Type':'application/json'}}); }
