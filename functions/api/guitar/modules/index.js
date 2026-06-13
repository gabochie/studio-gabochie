import { getUser, json } from '../_utils.js';

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
