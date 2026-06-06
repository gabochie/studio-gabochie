export async function onRequest(context) {
  const db = context.env.DB;
  const req = context.request;
  const user = await getUser(context);
  if (!user) return json({error:'Auth required'}, 401);

  if (req.method === 'POST') {
    const {chord_pair, score} = await req.json();
    await db.prepare('INSERT INTO guitar_one_minute_records (user_id, chord_pair, score) VALUES (?, ?, ?)').bind(user.id, chord_pair, score).run();
    return json({ok:true});
  }

  if (req.method === 'GET') {
    const {results} = await db.prepare('SELECT chord_pair, MAX(score) as best_score FROM guitar_one_minute_records WHERE user_id = ? GROUP BY chord_pair ORDER BY chord_pair').bind(user.id).all();
    return json({records: results});
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
function json(d, s=200) { return new Response(JSON.stringify(d), {status:s, headers:{'Content-Type':'application/json'}}); }
