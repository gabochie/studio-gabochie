const COMING_SOON = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Coming Soon — GideonAbochie Studio</title>
<link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Barlow:wght@300;400;500;600&family=Barlow+Condensed:ital,wght@0,400;0,600;0,700;1,600&family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%}
body{background:#0A1628;color:#CBD5E1;font-family:'Libre Baskerville',Georgia,serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
.wrap{text-align:center;max-width:600px}
.logo{width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#C9A84C,#8B7034);display:flex;align-items:center;justify-content:center;margin:0 auto 32px;font-size:32px;color:#0A1628;font-weight:700;font-family:'Barlow Condensed',sans-serif}
h1{font-family:'Barlow Condensed',sans-serif;font-size:clamp(42px,8vw,72px);font-weight:700;color:#F1F5F9;line-height:.9;margin-bottom:12px;text-transform:uppercase;letter-spacing:-.02em}
h1 span{color:#C9A84C}
.tagline{font-family:'Libre Baskerville',serif;font-style:italic;font-size:15px;color:#C9A84C;margin-bottom:32px;letter-spacing:.02em}
.desc{font-family:'Barlow',sans-serif;font-size:16px;color:#6B7F9A;line-height:1.8;margin-bottom:40px}
.desc strong{color:#94A3B8}
.notify{display:flex;gap:10px;max-width:420px;margin:0 auto;flex-wrap:wrap;justify-content:center}
.notify input{flex:1;min-width:200px;padding:14px 18px;border:1px solid #1E3250;border-radius:8px;background:#0F1E38;color:#CBD5E1;font-family:'Barlow',sans-serif;font-size:14px;outline:none;transition:border-color .2s}
.notify input:focus{border-color:#C9A84C}
.notify input::placeholder{color:#3A5278}
.notify button{padding:14px 28px;border:none;border-radius:8px;background:#C9A84C;color:#0A1628;font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;cursor:pointer;transition:background .2s}
.notify button:hover{background:#D9B85C}
.notify button:disabled{opacity:.5;cursor:not-allowed}
.socials{display:flex;justify-content:center;gap:12px;margin-top:40px}
.socials a{width:40px;height:40px;border-radius:8px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.03);display:flex;align-items:center;justify-content:center;text-decoration:none;color:#3A5278;font-size:16px;transition:all .2s}
.socials a:hover{color:#C9A84C;border-color:rgba(201,168,76,.3);background:rgba(201,168,76,.06)}
.footer{font-family:'Courier Prime',monospace;font-size:10px;color:#3A5278;margin-top:32px;letter-spacing:.05em;text-transform:uppercase}
.success{display:none;color:#22C55E;font-family:'Barlow',sans-serif;font-size:14px;padding:12px;margin-top:12px}
</style>
</head>
<body>
<div class="wrap">
  <div class="logo">GA</div>
  <h1>Coming<br><span>Soon</span></h1>
  <div class="tagline">School of Creativity, Love &amp; Wisdom</div>
  <p class="desc">We're building something beautiful — a space where <strong>creativity</strong>, <strong>love</strong>, and <strong>wisdom</strong> come together. Leave your email and we'll let you know the moment we launch.</p>
  <div class="notify">
    <input type="email" id="notifyEmail" placeholder="Your email address" required>
    <button id="notifyBtn" onclick="notifyMe()">Notify Me</button>
  </div>
  <div class="success" id="notifySuccess">&#10003; You're on the list! We'll notify you at launch.</div>
  <div class="socials">
    <a href="https://x.com/GideonAbochie" target="_blank" title="X / Twitter"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>
    <a href="https://web.facebook.com/GideonAbochie/" target="_blank" title="Facebook"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></a>
    <a href="https://www.instagram.com/gideonabochie/" target="_blank" title="Instagram"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg></a>
  </div>
  <div class="footer">GideonAbochie Studio &mdash; Accra, Ghana</div>
</div>
<script>
function notifyMe(){
  var btn = document.getElementById('notifyBtn');
  var email = document.getElementById('notifyEmail').value.trim();
  if (!email || !email.includes('@')) { alert('Please enter a valid email.'); return; }
  btn.disabled = true; btn.textContent = 'Subscribing\u2026';
  var fd = new FormData(); fd.append('email', email); fd.append('source', 'coming-soon');
  fetch('/api/contact', {method:'POST', body:fd}).then(function(r){
    if (!r.ok) throw new Error('Failed');
    document.getElementById('notifySuccess').style.display = 'block';
    btn.textContent = 'Done!';
    document.getElementById('notifyEmail').value = '';
  }).catch(function(){
    btn.disabled = false; btn.textContent = 'Notify Me';
    alert('Something went wrong. Please try again or follow us on social media.');
  });
}
</script>
</body>
</html>`;

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const host = request.headers.get('Host') || '';

  var isNews = host === 'news.gideonabochie.org' || host.startsWith('news.');

  // Only gate these paths (require login)
  var gatedPaths = ['/dashboard/'];
  var isGated = false;
  for (var i = 0; i < gatedPaths.length; i++) {
    if (path === gatedPaths[i] || path.startsWith(gatedPaths[i])) {
      isGated = true;
      break;
    }
  }

  // Validate session for gated paths
  var sessionValid = false;
  if (env.DB && isGated) {
    var cookie = request.headers.get('Cookie') || '';
    var m = cookie.match(/(?:^|;\s*)ga_session=([^;]+)/);
    if (m) {
      try {
        var row = await env.DB.prepare(
          "SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')"
        ).bind(m[1]).first();
        if (row) sessionValid = true;
      } catch (e) {}
    }
  }

  if (isGated && !sessionValid) {
    var loginUrl = '/login/?redirect=' + encodeURIComponent(path);
    return new Response(null, {
      status: 302,
      headers: { 'Location': loginUrl }
    });
  }

  // News subdomain: serve from /news/ directory
  if (isNews) {
    if (path.startsWith('/api/')) return context.next();
    var assetPath = path === '/' ? '/news/index.html' : '/news' + path;
    var response = await env.ASSETS.fetch(new URL(assetPath, request.url));
    if (response.status === 404) {
      response = await env.ASSETS.fetch(request.url);
    }
    return response;
  }

  // Check maintenance mode
  if (env.DB) {
    try {
      const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'coming_soon'").first();
      if (row && row.value === 'true') {
        return new Response(COMING_SOON, {
          status: 200,
          headers: { 'Content-Type': 'text/html;charset=utf-8' }
        });
      }
    } catch (e) {}
  }

  // CSRF protection: reject cross-origin mutating requests
  var origin = request.headers.get('Origin') || '';
  if (origin && !origin.includes(url.hostname) && !origin.includes('gideonabochie.org')) {
    var method = request.method;
    if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  return context.next();
}
