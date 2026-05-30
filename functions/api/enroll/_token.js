export function getToken(request, body) {
  var auth = request.headers.get('Authorization') || '';
  var m = auth.match(/^Bearer\s+(.+)$/i);
  if (m) return m[1];
  if (body && body.token) return (body.token || '').trim();
  var url = new URL(request.url);
  return url.searchParams.get('token') || '';
}
