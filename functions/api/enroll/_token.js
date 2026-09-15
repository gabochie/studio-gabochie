export function getToken(request, body) {
  var auth = request.headers.get('Authorization') || '';
  var m = auth.match(/^Bearer\s+(.+)$/i);
  if (m) return m[1];
  if (body && body.token) return (body.token || '').trim();
  var url = new URL(request.url);
  var q = url.searchParams.get('token');
  if (q) return q;
  var cookie = request.headers.get('Cookie') || '';
  var cm = cookie.match(/(?:^|;\s*)ga_session=([^;]+)/);
  if (cm) return cm[1];
  return '';
}

export function getSessionUser(db, token) {
  if (!token || !db) return null;
  return db.prepare(
    "SELECT s.user_id, u.email, u.name, u.membership_tier FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > datetime('now')"
  ).bind(token).first();
}
