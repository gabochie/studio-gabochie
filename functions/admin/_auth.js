import { verifyAccessJwt } from '../api/admin/_access-jwt.js';

export async function requireAdmin(request, env) {
  // 1. Try Cloudflare Access JWT
  var accessUser = await verifyAccessJwt(request, env);
  if (accessUser) return null;

  // 2. Fall back to admin API key
  const key = request.headers.get('X-Admin-Key') || '';
  const expected = env.ADMIN_API_KEY || env.ADMIN_KEY || '';

  if (!expected) {
    if (!env.CF_ACCESS_TEAM) {
      return new Response(JSON.stringify({ status: 'error', message: 'Admin API not configured' }), {
        status: 501, headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ status: 'error', message: 'Unauthorized' }), {
      status: 403, headers: { 'Content-Type': 'application/json' }
    });
  }

  if (key !== expected) {
    return new Response(JSON.stringify({ status: 'error', message: 'Unauthorized' }), {
      status: 403, headers: { 'Content-Type': 'application/json' }
    });
  }
  return null;
}
