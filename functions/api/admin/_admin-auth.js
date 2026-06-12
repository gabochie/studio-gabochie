export function requireAdminAuth(request, env) {
  var key = request.headers.get('X-Admin-Key') || '';
  var adminKey = env.ADMIN_API_KEY || env.ADMIN_KEY || '';
  if (!adminKey) {
    return new Response(JSON.stringify({ status: 'error', message: 'Admin API not configured' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }
  if (key !== adminKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return null;
}
