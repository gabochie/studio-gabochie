export async function onRequest(context) {
  const db = context.env.DB;
  const url = new URL(context.request.url);
  const user = await getUser(context);

  if (url.pathname === '/api/guitar/modules' && context.request.method === 'GET') {
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

  if (url.pathname.match(/^\/api\/guitar\/modules\/(\d+)$/) && context.request.method === 'GET') {
    const id = url.pathname.split('/').pop();
    const mod = await db.prepare('SELECT * FROM guitar_modules WHERE id = ?').bind(id).first();
    if (!mod) return json({error:'Not found'}, 404);
    const {results: lessons} = await db.prepare(
      'SELECT * FROM guitar_lessons WHERE module_id = ? ORDER BY sort_order'
    ).bind(id).all();
    let progress = {};
    if (user) {
      const ids = lessons.map(l => l.id);
      if (ids.length) {
        const {results: prog} = await db.prepare(
          `SELECT lesson_id, completed, xp FROM guitar_progress WHERE user_id = ? AND lesson_id IN (${ids.join(',')})`
        ).bind(user.id).all();
        prog.forEach(p => progress[p.lesson_id] = p);
      }
    }
    return json({module: mod, lessons, progress});
  }

  return json({error:'Not found'}, 404);
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
