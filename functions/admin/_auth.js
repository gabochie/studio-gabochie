export function requireAdmin(request, env) {
  const key = request.headers.get('X-Admin-Key') || '';
  const expected = env.ADMIN_API_KEY || env.ADMIN_KEY || '';
  if (!expected) {
    return new Response(JSON.stringify({ status: 'error', message: 'Admin API not configured' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }
  if (key !== expected) {
    return new Response(JSON.stringify({ status: 'error', message: 'Unauthorized' }), {
      status: 403, headers: { 'Content-Type': 'application/json' }
    });
  }
  return null;
}
