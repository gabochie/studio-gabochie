function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDate(iso) {
  try {
    var d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch (_e) { return ''; }
}

function parseArr(v) {
  try {
    var p = JSON.parse(v || '[]');
    return Array.isArray(p) ? p : [];
  } catch (_e) { return []; }
}

export async function onRequest(context) {
  var { request, env, params } = context;
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  var slug = (params && params.slug) || '';
  if (!slug || !env.DB) return new Response('Not found', { status: 404 });

  var post = await env.DB.prepare(
    "SELECT slug, title, excerpt, html, cover_image, tags, faqs, author, published_at, updated_at FROM posts WHERE slug = ? AND status = 'published'"
  ).bind(slug).first().catch(function () { return null; });

  if (!post) {
    // Function routes run before static serving: fall back to a pre-rendered
    // cornerstone file (e.g. /blog/what-is-creativity-coaching/) if present.
    try {
      if (env.ASSETS) {
        var staticRes = await env.ASSETS.fetch(new URL('/blog/' + slug + '/', request.url));
        if (staticRes && staticRes.status === 200) return staticRes;
      }
    } catch (_e) {}
    return new Response(
      '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Article Not Found — Studio Gabochie</title><style>body{font-family:Georgia,serif;background:#0A1628;color:#CBD5E1;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center}h1{color:#fff}a{color:#C9A84C}</style></head><body><div><h1>Article Not Found</h1><p>This story is still being written.</p><a href="/blog/">&larr; All articles</a></div></body></html>',
      { status: 404, headers: { 'Content-Type': 'text/html;charset=utf-8' } }
    );
  }

  var tags = parseArr(post.tags);
  var faqs = parseArr(post.faqs).filter(function (f) { return f && f.q && f.a; });
  var pageUrl = 'https://studio.gabochie.com/blog/' + encodeURIComponent(post.slug) + '/';
  var desc = (post.excerpt || '').slice(0, 160);
  var img = post.cover_image || 'https://studio.gabochie.com/assets/images/og-image.jpg';

  var faqJson = faqs.length ? ', "mainEntity": [{"@type": "FAQPage", "mainEntity": [' +
    faqs.map(function (f) {
      return '{"@type": "Question", "name": ' + JSON.stringify(f.q) + ', "acceptedAnswer": {"@type": "Answer", "text": ' + JSON.stringify(f.a) + '}}';
    }).join(',') + ']}]' : '';

  var faqHtml = faqs.length ? '<section class="faq"><h2>Questions, answered</h2>' +
    faqs.map(function (f) {
      return '<div class="faq-item"><h3>' + esc(f.q) + '</h3><p>' + esc(f.a) + '</p></div>';
    }).join('') + '</section>' : '';

  var tagHtml = tags.length ? '<p class="tags">' + tags.map(function (t) {
    return '<a href="/blog/?tag=' + encodeURIComponent(t) + '">' + esc(t) + '</a>';
  }).join('') + '</p>' : '';

  var related = [];
  try {
    if (tags.length) {
      var r = await env.DB.prepare(
        "SELECT slug, title, excerpt FROM posts WHERE status = 'published' AND slug != ? AND tags LIKE ? ORDER BY published_at DESC LIMIT 3"
      ).bind(post.slug, '%' + tags[0] + '%').all();
      related = r.results || [];
    }
    if (!related.length) {
      var r2 = await env.DB.prepare(
        "SELECT slug, title, excerpt FROM posts WHERE status = 'published' AND slug != ? ORDER BY published_at DESC LIMIT 3"
      ).bind(post.slug).all();
      related = (r2.results || []);
    }
  } catch (_e) { related = []; }

  var relatedHtml = related.length ? '<section class="related"><h2>Keep reading</h2><div>' +
    related.map(function (p) {
      return '<a href="/blog/' + encodeURIComponent(p.slug) + '/"><strong>' + esc(p.title) + '</strong><span>' + esc((p.excerpt || '').slice(0, 120)) + '</span></a>';
    }).join('') + '</div></section>' : '';

  var html = '<!DOCTYPE html><html lang="en"><head>' +
    '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">' +
    '<title>' + esc(post.title) + ' — Studio Gabochie</title>' +
    '<meta name="description" content="' + esc(desc) + '">' +
    '<link rel="canonical" href="' + pageUrl + '">' +
    '<meta property="og:title" content="' + esc(post.title) + '">' +
    '<meta property="og:description" content="' + esc(desc) + '">' +
    '<meta property="og:type" content="article">' +
    '<meta property="og:url" content="' + pageUrl + '">' +
    '<meta property="og:image" content="' + esc(img) + '">' +
    '<meta property="article:published_time" content="' + esc(post.published_at || '') + '">' +
    '<meta name="twitter:card" content="summary_large_image">' +
    '<meta name="twitter:title" content="' + esc(post.title) + '">' +
    '<meta name="twitter:description" content="' + esc(desc) + '">' +
    '<meta name="theme-color" content="#0A1628">' +
    '<link rel="icon" type="image/x-icon" href="data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 32 32\'><rect width=\'32\' height=\'32\' rx=\'6\' fill=\'%23C9A84C\'/><text x=\'16\' y=\'22\' font-size=\'18\' font-weight=\'bold\' text-anchor=\'middle\' fill=\'%230A1628\'>G</text></svg>">' +
    '<script type="application/ld+json">' +
    '{"@context":"https://schema.org","@type":"BlogPosting","headline":' + JSON.stringify(post.title) +
    ',"description":' + JSON.stringify(desc) +
    ',"url":"' + pageUrl + '","datePublished":"' + esc(post.published_at || '') + '","dateModified":"' + esc(post.updated_at || post.published_at || '') + '"' +
    ',"author":{"@type":"Person","name":' + JSON.stringify(post.author || 'Gideon Abochie') + ',"url":"https://studio.gabochie.com/"}' +
    ',"publisher":{"@type":"Organization","name":"Studio Gabochie","url":"https://studio.gabochie.com"}}' +
    faqJson + '</script>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Barlow:wght@300;400;500;600&family=Barlow+Condensed:wght@400;600;700&display=swap" rel="stylesheet">' +
    '<link rel="stylesheet" href="/assets/css/main.css">' +
    '<style>' +
    'body{font-family:\'Libre Baskerville\',Georgia,serif;background:#0A1628;color:#CBD5E1}' +
    '.post{max-width:760px;margin:0 auto;padding:120px 24px 40px}' +
    '.crumbs{font-size:12px;color:#5A7A9F;margin-bottom:16px;font-family:\'DM Sans\',sans-serif}' +
    '.crumbs a{color:#C9A84C;text-decoration:none}' +
    'h1{font-family:\'Barlow Condensed\',sans-serif;font-size:clamp(34px,5vw,52px);color:#fff;line-height:1.05;margin:0 0 12px}' +
    '.standfirst{font-size:17px;color:#8A9BB5;line-height:1.7;border-left:3px solid #C9A84C;padding-left:16px;margin:0 0 16px}' +
    '.byline{font-size:12px;color:#5A7A9F;margin-bottom:32px;font-family:\'DM Sans\',sans-serif}' +
    '.answer{background:rgba(201,168,76,.06);border:1px solid rgba(201,168,76,.25);border-radius:12px;padding:20px 22px;margin-bottom:32px}' +
    '.answer strong{display:block;font-family:\'Courier Prime\',monospace;font-size:11px;letter-spacing:.25em;text-transform:uppercase;color:#C9A84C;margin-bottom:8px}' +
    '.answer p{margin:0;font-size:15px;line-height:1.7;color:#E8EEF7}' +
    '.body{font-size:16px;line-height:1.85;color:#CBD5E1}' +
    '.body h2{font-family:\'Barlow Condensed\',sans-serif;font-size:26px;color:#fff;margin:40px 0 12px}' +
    '.body h3{font-family:\'Barlow Condensed\',sans-serif;font-size:20px;color:#E8EEF7;margin:28px 0 8px}' +
    '.body p{margin:0 0 18px}' +
    '.body ul,.body ol{margin:0 0 18px;padding-left:24px}' +
    '.body li{margin-bottom:8px}' +
    '.body blockquote{border-left:3px solid #C9A84C;margin:24px 0;padding:4px 0 4px 18px;font-style:italic;color:#E8EEF7}' +
    '.body a{color:#C9A84C}' +
    '.tags{margin:32px 0 0;display:flex;gap:8px;flex-wrap:wrap}' +
    '.tags a{font-size:12px;color:#8A9BB5;border:1px solid #1E3250;border-radius:20px;padding:4px 14px;text-decoration:none;font-family:\'DM Sans\',sans-serif}' +
    '.faq{margin-top:48px;border-top:1px solid #1E3250;padding-top:32px}' +
    '.faq h2{font-family:\'Barlow Condensed\',sans-serif;font-size:26px;color:#fff;margin:0 0 16px}' +
    '.faq-item{margin-bottom:20px}' +
    '.faq-item h3{font-size:16px;color:#E8EEF7;margin:0 0 6px}' +
    '.faq-item p{font-size:14px;color:#8A9BB5;line-height:1.7;margin:0}' +
    '.related{margin-top:48px;border-top:1px solid #1E3250;padding-top:32px}' +
    '.related h2{font-family:\'Barlow Condensed\',sans-serif;font-size:26px;color:#fff;margin:0 0 16px}' +
    '.related div{display:grid;gap:12px}' +
    '.related a{display:block;background:#0F1E38;border:1px solid #1E3250;border-radius:10px;padding:16px 18px;text-decoration:none}' +
    '.related strong{display:block;color:#E8EEF7;font-size:15px;margin-bottom:4px}' +
    '.related span{color:#8A9BB5;font-size:13px;line-height:1.5}' +
    '.cta-band{text-align:center;padding:56px 24px;background:linear-gradient(135deg,#0F1E38,#162540);border-top:1px solid rgba(201,168,76,.15);margin-top:56px}' +
    '.cta-band h2{font-family:\'Barlow Condensed\',sans-serif;font-size:30px;color:#fff;margin:0 0 8px}' +
    '.cta-band p{color:#8A9BB5;font-size:14px;margin:0 0 20px}' +
    '.cta-band a{display:inline-block;padding:14px 36px;background:#C9A84C;color:#0A1628;border-radius:8px;font-family:\'Barlow Condensed\',sans-serif;font-weight:700;letter-spacing:.15em;text-transform:uppercase;text-decoration:none}' +
    '.nl{max-width:560px;margin:0 auto 8px;padding:0 24px 56px;text-align:center}' +
    '.nl input{width:100%;padding:12px 16px;border:1px solid #1E3250;border-radius:8px;background:#0F1E38;color:#E8EEF7;margin-bottom:10px;font-size:14px;box-sizing:border-box}' +
    '.nl button{width:100%;padding:12px;background:transparent;border:1px solid #C9A84C;color:#C9A84C;border-radius:8px;cursor:pointer;font-family:\'Barlow Condensed\',sans-serif;letter-spacing:.15em;text-transform:uppercase}' +
    '.nl .msg{font-size:13px;margin-top:8px;display:none}' +
    '</style></head><body>' +
    '<div id="nav-placeholder"></div>' +
    '<article class="post">' +
    '<p class="crumbs"><a href="/">Home</a> · <a href="/blog/">Articles</a></p>' +
    '<h1>' + esc(post.title) + '</h1>' +
    '<p class="standfirst">' + esc(desc) + '</p>' +
    '<p class="byline">By ' + esc(post.author || 'Gideon Abochie') + ' · ' + esc(fmtDate(post.published_at)) + ' · Studio Gabochie</p>' +
    '<div class="answer"><strong>The short answer</strong><p>' + esc(desc) + '</p></div>' +
    '<div class="body">' + (post.html || '') + '</div>' +
    tagHtml + faqHtml + relatedHtml +
    '</article>' +
    '<div class="cta-band"><h2>Learn it by <span style="color:#C9A84C">doing it.</span></h2>' +
    '<p>Every idea here is taught step-by-step inside our courses. Module 1 is free.</p>' +
    '<a href="/courses/">Explore Courses — Free</a></div>' +
    '<div class="nl"><h2 style="font-family:\'Barlow Condensed\',sans-serif;color:#fff">Get the next article</h2>' +
    '<p style="color:#8A9BB5;font-size:13px">One practical essay a week. No spam.</p>' +
    '<input id="nlEmail" type="email" placeholder="you@example.com">' +
    '<button onclick="blogSubscribe()">Subscribe Free</button>' +
    '<p class="msg" id="nlMsg"></p></div>' +
    '<div id="footer-placeholder"></div>' +
    '<script>function blogSubscribe(){var e=document.getElementById("nlEmail").value.trim();var m=document.getElementById("nlMsg");if(!e||e.indexOf("@")<0){m.style.display="block";m.style.color="#E8637A";m.textContent="Enter a valid email.";return;}fetch("/api/subscribe",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:e,source:"blog-post"})}).then(function(r){return r.json()}).then(function(){m.style.display="block";m.style.color="#22C55E";m.textContent="Check your inbox to confirm.";}).catch(function(){m.style.display="block";m.style.color="#E8637A";m.textContent="Something went wrong.";});}</script>' +
    '<script src="/nav.js"></script>' +
    '</body></html>';

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html;charset=utf-8',
      'Cache-Control': 'public, max-age=3600, must-revalidate'
    }
  });
}
