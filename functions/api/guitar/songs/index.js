import { json } from '../_utils.js';

export async function onRequest(context) {
  const db = context.env.DB;
  const req = context.request;
  const url = new URL(req.url);

  if (req.method === 'GET' && url.pathname === '/api/guitar/songs') {
    const {results} = await db.prepare('SELECT * FROM guitar_songs ORDER BY difficulty, title').all();
    return json({songs: results});
  }

  const songMatch = url.pathname.match(/^\/api\/guitar\/songs\/(\d+)$/);
  if (songMatch && req.method === 'GET') {
    const song = await db.prepare('SELECT * FROM guitar_songs WHERE id = ?').bind(parseInt(songMatch[1])).first();
    if (!song) return json({error:'Not found'}, 404);
    return json({song});
  }

  return json({error:'Not found'}, 404);
}
