import { json } from '../_utils.js';

export async function onRequest(context) {
  const db = context.env.DB;
  try {
    await db.prepare("CREATE TABLE IF NOT EXISTS guitar_lesson_videos (lesson_id INTEGER PRIMARY KEY, youtube_id TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
    const { results } = await db.prepare("SELECT lesson_id, youtube_id FROM guitar_lesson_videos WHERE youtube_id != ''").all();
    const videos = {};
    (results || []).forEach(r => { videos[r.lesson_id] = r.youtube_id; });
    return json({ videos });
  } catch {
    return json({ videos: {} });
  }
}
