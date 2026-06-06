export async function onRequest(context) {
  const db = context.env.DB;
  const user = await getUser(context);
  if (!user) return json({unlocked: false});
  const payment = await db.prepare("SELECT status FROM guitar_payments WHERE user_id = ? AND status = 'completed' ORDER BY id DESC LIMIT 1").bind(user.id).first();
  return json({unlocked: !!payment, trialModules: 3});
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
