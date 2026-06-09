export async function onRequest(context) {
  const db = context.env.DB;
  const req = context.request;
  const user = await getUser(context);
  if (!user) return json({error:'Auth required'}, 401);

  if (req.method === 'POST') {
    const existing = await db.prepare("SELECT id, status FROM guitar_payments WHERE user_id = ? ORDER BY id DESC LIMIT 1").bind(user.id).first();
    if (existing && existing.status === 'completed') return json({ok:true, alreadyUnlocked: true});

    const tx_ref = 'GUITAR_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
    await db.prepare("INSERT INTO guitar_payments (user_id, email, status, flw_tx_ref, amount, plan) VALUES (?, ?, ?, ?, 250, ?)").bind(user.id, user.email, 'pending', tx_ref, 'full').run();
    return json({tx_ref, amount: 250, currency: 'GHS', message: 'Pay with Flutterwave to unlock all modules'});
  }
  return json({error:'Method not allowed'}, 405);
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
