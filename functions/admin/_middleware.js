export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // Allow login page and API through without auth
  if (path === '/admin/login' || path === '/admin/api/login' || path === '/admin/api/logout') {
    return next();
  }

  // Check for auth cookie
  const cookie = request.headers.get('Cookie') || '';
  if (/auth_token=\w+/.test(cookie)) {
    return next();
  }

  // Not authenticated — redirect to login
  return new Response(null, {
    status: 302,
    headers: { Location: '/admin/login' }
  });
}
