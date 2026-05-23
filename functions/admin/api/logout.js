export async function onRequest(context) {
  const response = Response.redirect(new URL('/admin/login', context.request.url).href, 302);
  response.headers.append('Set-Cookie', 'auth_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  return response;
}
