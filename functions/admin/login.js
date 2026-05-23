export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // GET — show login form
  if (request.method === 'GET') {
    const error = url.searchParams.get('error');
    return new Response(renderLogin(error), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // POST — validate password
  if (request.method === 'POST') {
    const formData = await request.formData();
    const password = formData.get('password') || '';
    const correctPassword = env.ADMIN_PASSWORD || 'gideonAdmin2026';

    if (password === correctPassword) {
      const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
      const response = Response.redirect(new URL('/admin/', url).href, 302);
      response.headers.append('Set-Cookie', `auth_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
      return response;
    }

    return Response.redirect(new URL('/admin/login?error=1', url).href, 302);
  }

  return new Response('Method not allowed', { status: 405 });
}

function renderLogin(error) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin Login — GideonAbochie Studio</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',system-ui,-apple-system,sans-serif;background:#0A1628;color:#CBD5E1;min-height:100vh;display:flex;align-items:center;justify-content:center}
.login-wrap{width:100%;max-width:400px;padding:24px}
.login-box{background:#0F1E38;border:1px solid #1E3250;border-radius:14px;padding:40px 32px;text-align:center}
.login-logo{font-size:32px;margin-bottom:8px}
.login-box h1{font-size:20px;color:#E8EEF7;margin-bottom:4px}
.login-box p{font-size:13px;color:#5A7A9F;margin-bottom:28px}
.login-box form{display:flex;flex-direction:column;gap:14px}
.login-box input[type="password"]{width:100%;padding:14px 16px;border-radius:8px;border:1px solid #1E3250;background:#0A1628;color:#E8EEF7;font-size:14px;outline:none;font-family:'DM Sans',sans-serif;transition:border-color 0.2s}
.login-box input[type="password"]:focus{border-color:#C9A84C}
.login-box input[type="password"]::placeholder{color:#3A5278}
.login-box button{width:100%;padding:14px;border-radius:8px;border:none;background:#C9A84C;color:#0A1628;font-size:14px;font-weight:600;cursor:pointer;transition:background 0.2s;font-family:'DM Sans',sans-serif}
.login-box button:hover{background:#D9B85C}
.error-msg{font-size:12px;color:#E8637A;background:rgba(232,99,122,0.1);padding:10px 14px;border-radius:6px;display:${error ? 'block' : 'none'}}
.login-footer{font-size:11px;color:#3A5278;margin-top:20px}
</style>
</head>
<body>
<div class="login-wrap">
  <div class="login-box">
    <div class="login-logo">&#128274;</div>
    <h1>Admin Login</h1>
    <p>GideonAbochie Studio</p>
    <div class="error-msg">Incorrect password. Try again.</div>
    <form method="POST" action="/admin/login">
      <input type="password" name="password" placeholder="Enter admin password" required autofocus>
      <button type="submit">Sign In</button>
    </form>
    <div class="login-footer"><a href="/" style="color:#3A5278;text-decoration:none">&larr; Back to site</a></div>
  </div>
</div>
</body>
</html>`;
}
