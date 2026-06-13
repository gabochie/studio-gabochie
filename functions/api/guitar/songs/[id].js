import { json } from '../_utils.js';

export async function onRequest(context) {
  const db = context.env.DB;
  const id = parseInt(context.params.id);
  const song = await db.prepare('SELECT * FROM guitar_songs WHERE id = ?').bind(id).first();
  if (!song) return json({error:'Not found'}, 404);
  return json({song});
}
