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

async function getUser(ctx) {
  const auth = ctx.request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const session = await ctx.env.DB.prepare('SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime("now")').bind(token).first();
  if (!session) return null;
  return await ctx.env.DB.prepare('SELECT id, email, name FROM users WHERE id = ?').bind(session.user_id).first();
}
function json(d, s=200) { return new Response(JSON.stringify(d), {status:s, headers:{'Content-Type':'application/json'}}); }
