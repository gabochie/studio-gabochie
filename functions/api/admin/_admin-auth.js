export function requireAdminAuth(request, env) {
  var key = request.headers.get('X-Admin-Key') || '';
  if (env.ADMIN_KEY && key !== env.ADMIN_KEY) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
  return null;
}
