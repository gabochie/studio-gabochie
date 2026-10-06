import { genToken } from '../auth/_hash.js';

// Mint a user session for an email address (find-or-create users row).
// Best-effort: returns '' on any failure so callers never break their
// primary flow (enroll / login / survey) when session creation fails.
export async function mintSessionForEmail(db, email, name) {
  if (!db || !email) return '';
  try {
    var em = String(email).trim().toLowerCase();
    if (!em || em.indexOf('@') < 0) return '';
    var user = await db.prepare('SELECT id FROM users WHERE email = ?').bind(em).first();
    if (!user) {
      var r = await db.prepare('INSERT INTO users (name, email) VALUES (?, ?)').bind(name || em, em).run();
      var id = (r && r.meta && r.meta.last_row_id) || null;
      if (id) {
        user = { id: id };
      } else {
        user = await db.prepare('SELECT id FROM users WHERE email = ?').bind(em).first();
      }
    }
    if (!user) return '';
    var token = genToken();
    await db.prepare("INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, datetime('now', '+30 days'))").bind(user.id, token).run();
    return token;
  } catch (_e) {
    return '';
  }
}
