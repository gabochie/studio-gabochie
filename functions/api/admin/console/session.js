// GET /api/admin/console/session — who am I (requires valid ga_admin cookie)
// DELETE /api/admin/console/session — logout
import { getConsoleUser, clearConsoleCookie, logConsoleAction } from '../_console-session.js';

function json(body, status, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status: status,
    headers: Object.assign({ 'Content-Type': 'application/json' }, extraHeaders || {})
  });
}

export async function onRequest(context) {
  var { request, env } = context;
  var db = env.DB;
  if (!db) return json({ status: 'error', message: 'D1 not bound' }, 501);

  if (request.method === 'GET') {
    var user = await getConsoleUser(db, request);
    if (!user) return json({ status: 'error', message: 'Not authenticated' }, 401);
    return json({ status: 'ok', user: { name: user.name, email: user.email, role: user.role } });
  }

  if (request.method === 'DELETE') {
    var cookie = request.headers.get('Cookie') || '';
    var m = cookie.match(/(?:^|;\s*)ga_admin=([^;]+)/);
    var user2 = await getConsoleUser(db, request);
    if (m) {
      try { await db.prepare('DELETE FROM sessions WHERE token = ?').bind(m[1]).run(); } catch (_e) {}
    }
    if (user2) await logConsoleAction(db, 'console_logout', { actorEmail: user2.email });
    return json({ status: 'ok' }, 200, { 'Set-Cookie': clearConsoleCookie() });
  }

  return json({ status: 'error', message: 'Method not allowed' }, 405);
}
