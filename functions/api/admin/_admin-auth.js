import { verifyAccessJwt } from './_access-jwt.js';
import { getConsoleUser } from './_console-session.js';

export async function requireAdminAuth(request, env) {
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key, X-CI-Secret' };

  // 1. Try Cloudflare Access JWT
  var accessUser = await verifyAccessJwt(request, env);
  if (accessUser) return null; // authenticated via Access

  // 2. Fall back to admin API key
  var key = request.headers.get('X-Admin-Key') || '';
  var adminKey = env.ADMIN_API_KEY || env.ADMIN_KEY || '';

  if (adminKey && key === adminKey) return null;

  // 3. Fall back to console role session (super_admin / admin named accounts)
  if (env.DB) {
    var consoleUser = await getConsoleUser(env.DB, request);
    if (consoleUser) return null;
  }

  if (!adminKey) {
    if (!env.CF_ACCESS_TEAM) {
      return new Response(JSON.stringify({ status: 'error', message: 'Admin API not configured' }), {
        status: 501, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    // If Access is configured but JWT is missing, let Access handle it
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 403, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  }

  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 403, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
  });
}
