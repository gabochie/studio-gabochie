export async function onRequest(context) {
  const db = context.env.DB;
  const user = await getUser(context);

  const tiers = ['bronze','silver','gold'];
  const modules = [];
  for (const tier of tiers) {
    const {results} = await db.prepare(
      'SELECT * FROM guitar_modules WHERE tier = ? ORDER BY sort_order'
    ).bind(tier).all();
    modules.push({tier, modules: results});
  }
  return json({modules, totalModules: modules.reduce((a,t) => a + t.modules.length, 0)});
}

async function getUser(ctx) {
  const auth = ctx.request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const session = await ctx.env.DB.prepare(
    'SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime("now")'
  ).bind(token).first();
  if (!session) return null;
  return await ctx.env.DB.prepare('SELECT id, email, name FROM users WHERE id = ?').bind(session.user_id).first();
}

function json(data, status=200) {
  return new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}});
}
