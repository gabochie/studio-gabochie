var esc = function(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); };

export async function onRequest(context) {
  var pageUrl = 'https://gideonabochie.org/school/guitar/buy';

  var faqs = [
    { q: 'Do I need any prior experience?', a: 'No. The course starts from absolute zero — parts of the guitar, holding it, first notes. You will be playing chords by Module 3.' },
    { q: 'What guitar do I need?', a: 'Any acoustic or electric guitar with 6 strings. A standard steel-string acoustic is ideal.' },
    { q: 'How is this different from YouTube?', a: 'YouTube is random. This is systematic — structured curriculum, deliberate practice, progress tracking, pitch detection. It is the difference between wandering and a GPS.' },
    { q: 'What payment methods do you accept?', a: 'Flutterwave processes all payments — Mobile Money (Momo), Visa, Mastercard, and bank transfers. GH¢ 299 one-time, lifetime access.' },
    { q: 'Can I really learn in 20 days?', a: 'You will play your first song in Module 6 (day ~6). Full fluency takes consistent practice — the course is designed for 15-20 min per day.' },
    { q: 'What if I am not satisfied?', a: 'Modules 1-3 are completely free — no credit card required. Try them first. If you love it, unlock the full course.' },
  ];

  var faqHtml = faqs.map(function(f, i) {
    return '<div class="faq-item"><button class="faq-q" onclick="toggleFaq(' + i + ')" aria-expanded="false">' + esc(f.q) + '<span class="faq-arrow">+</span></button><div class="faq-a" id="faq' + i + '">' + esc(f.a) + '</div></div>';
  }).join('');

  var flwPublicKey = context.env.FLW_PUBLIC_KEY;
  if (!flwPublicKey && context.env.DB) {
    try {
      var setting = await context.env.DB.prepare("SELECT value FROM settings WHERE key = 'guitar_flutterwave_key'").first();
      if (setting?.value) flwPublicKey = setting.value;
    } catch(_) {}
  }
  flwPublicKey = flwPublicKey || 'FLWPUBK_TEST-6f4a7e5d8c9b0a1d2e3f4a5b6c7d8e9f-X';

  var html = '<!DOCTYPE html><html lang="en"><head>' +
    '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Gideon Guitar Method — Learn Ghanaian Songs on Guitar</title>' +
    '<meta name="description" content="Learn to play your favorite Ghanaian songs on guitar. 16 modules, 64 video lessons, real-time pitch detection, deliberate practice system. Lifetime access for GH¢ 299.">' +
    '<meta property="og:title" content="Gideon Guitar Method — Learn Ghanaian Songs on Guitar">' +
    '<meta property="og:description" content="16 modules, 64 video lessons, real-time pitch detection. Play Sarkodie, King Promise, Joe Mettle & more. Lifetime access GH¢ 299.">' +
    '<meta property="og:type" content="website">' +
    '<meta property="og:url" content="' + pageUrl + '">' +
    '<meta property="og:image" content="https://gideonabochie.org/assets/images/guitar-og.jpg">' +
    '<meta name="twitter:card" content="summary_large_image">' +
    '<meta name="twitter:title" content="Gideon Guitar Method — Learn Ghanaian Songs on Guitar">' +
    '<meta name="twitter:description" content="16 modules, 64 video lessons, real-time pitch detection. Play your favorite Ghanaian songs. Lifetime access GH¢ 299.">' +
    '<link rel="canonical" href="' + pageUrl + '">' +
    '<script src="https://checkout.flutterwave.com/v3.js"></script>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Barlow+Condensed:wght@600;700;800&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">' +
    '<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon=\'{"token": "YOUR_TOKEN"}\'></script>' +
    '<style>' +
    '*{margin:0;padding:0;box-sizing:border-box}' +
    'body{font-family:"Inter",sans-serif;background:#0A1628;color:#CBD5E1;overflow-x:hidden}' +
    '.wrap{max-width:720px;margin:0 auto;padding:24px 20px 80px}' +
    '.hero{text-align:center;padding:40px 0 32px}' +
    '.hero img{height:40px;margin-bottom:20px}' +
    '.h1{font-family:"Barlow Condensed",sans-serif;font-size:clamp(32px,6vw,52px);font-weight:800;line-height:1.05;color:#C9A84C;letter-spacing:-.02em;margin-bottom:12px}' +
    '.h1 em{font-style:normal;color:#F1F5F9}' +
    '.sub{font-size:clamp(15px,2.5vw,18px);color:#94A3B8;line-height:1.6;margin-bottom:24px}' +
    '.stats{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-bottom:32px}' +
    '.stat{text-align:center;padding:16px 20px;background:rgba(200,155,60,.06);border:1px solid rgba(200,155,60,.12);border-radius:10px;min-width:100px}' +
    '.stat-num{font-family:"Barlow Condensed",sans-serif;font-size:28px;font-weight:800;color:#C9A84C}' +
    '.stat-label{font-size:12px;color:#6B7F9A;margin-top:2px}' +
    '.btn{display:inline-flex;align-items:center;gap:8px;padding:14px 32px;border-radius:10px;font-size:16px;font-weight:600;cursor:pointer;border:none;text-decoration:none;transition:all .2s;font-family:"Inter",sans-serif}' +
    '.btn-primary{background:#C9A84C;color:#0A1628}' +
    '.btn-primary:hover{background:#D9B85C}' +
    '.btn-primary:disabled{opacity:.5;cursor:not-allowed}' +
    '.btn-ghost{background:transparent;border:1px solid rgba(255,255,255,.12);color:#CBD5E1}' +
    '.btn-lg{padding:16px 40px;font-size:18px}' +
    '.btn-block{width:100%;justify-content:center}' +
    '.section{margin-bottom:40px}' +
    '.section-title{font-family:"Barlow Condensed",sans-serif;font-size:clamp(24px,4vw,36px);font-weight:800;color:#F1F5F9;margin-bottom:12px}' +
    '.section-title em{font-style:normal;color:#C9A84C}' +
    '.p{font-size:15px;color:#94A3B8;line-height:1.75;margin-bottom:16px}' +
    '.p strong{color:#E2E8F0}' +
    '.pull-quote{padding:24px;border-left:3px solid #C9A84C;background:rgba(200,155,60,.06);border-radius:0 10px 10px 0;margin-bottom:24px;font-size:15px;color:#94A3B8;line-height:1.6;font-style:italic}' +
    '.pull-quote cite{display:block;font-style:normal;font-size:12px;color:#64748B;margin-top:8px}' +
    '.value-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px}' +
    '@media(max-width:480px){.value-grid{grid-template-columns:1fr}}' +
    '.value-item{background:linear-gradient(135deg,rgba(20,20,20,.6),rgba(10,10,10,.6));border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:16px}' +
    '.value-icon{font-size:24px;margin-bottom:4px}' +
    '.value-title{font-family:"Syne",sans-serif;font-size:13px;font-weight:700;color:#F1F5F9;margin-bottom:2px}' +
    '.value-desc{font-size:12px;color:#64748B;line-height:1.4}' +
    '.features{max-width:100%;margin-bottom:24px}' +
    '.features li{font-size:14px;color:#94A3B8;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04);list-style:none}' +
    '.features li::before{content:"✓ ";color:#C9A84C;font-weight:700}' +
    '.pricing-card{text-align:center;padding:36px 24px;background:linear-gradient(180deg,rgba(200,155,60,.08),transparent);border:2px solid rgba(200,155,60,.15);border-radius:14px;margin-bottom:24px}' +
    '.pricing-old{font-size:16px;color:#64748B;text-decoration:line-through;margin-bottom:2px}' +
    '.pricing-amount{font-family:"Barlow Condensed",sans-serif;font-size:64px;font-weight:800;color:#C9A84C;line-height:1;margin-bottom:2px}' +
    '.pricing-label{font-size:13px;color:#94A3B8;margin-bottom:16px}' +
    '.pricing-urgency{font-size:12px;color:#F87171;font-weight:600;padding:8px 14px;background:rgba(248,113,113,.1);border-radius:6px;display:inline-block;margin-bottom:20px}' +
    '.guarantee{display:flex;align-items:center;gap:16px;padding:16px 20px;background:rgba(52,199,123,.06);border:1px solid rgba(52,199,123,.12);border-radius:10px;margin-bottom:24px}' +
    '.guarantee-icon{font-size:32px;flex-shrink:0}' +
    '.guarantee-text{font-size:13px;color:#94A3B8;line-height:1.5}' +
    '.guarantee-text strong{color:#34C77B}' +
    '.divider{height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent);margin:32px 0}' +
    '.faq-item{border-bottom:1px solid rgba(255,255,255,.06);padding:14px 0}' +
    '.faq-q{font-size:14px;font-weight:600;color:#F1F5F9;cursor:pointer;display:flex;justify-content:space-between;align-items:center;width:100%;background:none;border:none;padding:0;font-family:"Inter",sans-serif}' +
    '.faq-a{font-size:13px;color:#64748B;line-height:1.6;padding-top:8px;display:none}' +
    '.faq-a.open{display:block}' +
    '.faq-arrow{font-size:18px;color:#C9A84C;transition:transform .2s}' +
    '.sticky-cta{position:fixed;bottom:0;left:0;right:0;padding:12px 20px;background:rgba(10,22,40,.95);backdrop-filter:blur(12px);border-top:1px solid rgba(200,155,60,.15);display:none;z-index:100}' +
    '.sticky-cta.show{display:block}' +
    '@media(max-width:640px){.sticky-cta{display:block}}' +
    '.proof-bar{display:flex;gap:24px;flex-wrap:wrap;align-items:center;padding:16px 20px;background:rgba(200,155,60,.06);border:1px solid rgba(200,155,60,.12);border-radius:10px;margin-bottom:32px}' +
    '.proof-num{font-family:"Barlow Condensed",sans-serif;font-size:36px;font-weight:800;color:#C9A84C;line-height:1}' +
    '.proof-text{font-size:13px;color:#94A3B8;line-height:1.4}' +
    '.proof-text strong{color:#F1F5F9}' +
    '.center{text-align:center}' +
    '</style>' +
    '</head><body>' +

    '<div class="wrap">' +

    '<div class="hero">' +
    '<img src="/assets/images/logo.png" alt="GideonAbochie Studio" style="height:40px">' +
    '<div class="h1">Learn to Play <em>Your Favorite Ghanaian Songs</em> on Guitar</div>' +
    '<div class="sub">16 modules · 64 video lessons · Real-time pitch detection · Deliberate practice system · Lifetime access</div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:24px">' +
    '<button class="btn btn-primary btn-lg" id="heroBtn" onclick="startBuy()">Get Full Access — GH¢ 299 <span style="font-size:18px">→</span></button>' +
    '<a href="/school/guitar/learn/" class="btn btn-ghost btn-lg">Try Free <span style="font-size:18px">→</span></a>' +
    '</div>' +
    '<div class="stats">' +
    '<div class="stat"><div class="stat-num">16</div><div class="stat-label">Modules</div></div>' +
    '<div class="stat"><div class="stat-num">64</div><div class="stat-label">Lessons</div></div>' +
    '<div class="stat"><div class="stat-num">15+</div><div class="stat-label">Ghanaian Songs</div></div>' +
    '<div class="stat"><div class="stat-num">✓</div><div class="stat-label">Pitch Detection</div></div>' +
    '</div>' +
    '</div>' +

    '<div class="divider"></div>' +

    '<div class="section">' +
    '<div class="section-title"><em>The Hardest Part</em> Is Not the Guitar</div>' +
    '<div class="p">You bought a guitar. You are motivated. You watched YouTube tutorials for hours.</div>' +
    '<div class="p">But when you try to play... your fingers will not move. The chord sounds dead. The strumming feels wrong. Every "beginner tutorial" assumes you already know more than you do.</div>' +
    '<div class="p"><strong>You are not alone.</strong> Studies show 90% of beginner guitarists quit within the first 90 days. Not because they lack talent — but because they lack a system.</div>' +
    '<div class="pull-quote">"I spent years trying to learn from scattered YouTube videos. Gideon\u2019s method gave me structure — now I can actually play through full songs."<cite>— Emmanuel K., Accra</cite></div>' +
    '</div>' +

    '<div class="divider"></div>' +

    '<div class="section">' +
    '<div class="section-title"><em>The Gideon Guitar Method</em> — Built on Science</div>' +
    '<div class="p">This is not another chord chart. It is a complete practice system based on peer-reviewed research:</div>' +
    '<div class="value-grid">' +
    '<div class="value-item"><div class="value-icon">🎯</div><div class="value-title">Deliberate Practice</div><div class="value-desc">Always work on your weakest link, not what you already know</div></div>' +
    '<div class="value-item"><div class="value-icon">🔄</div><div class="value-title">Spaced Repetition</div><div class="value-desc">15 min/day beats 3 hr/weekends — retention triples</div></div>' +
    '<div class="value-item"><div class="value-icon">🔀</div><div class="value-title">Interleaving</div><div class="value-desc">Mix skills randomly — builds robust neural pathways</div></div>' +
    '<div class="value-item"><div class="value-icon">⚡</div><div class="value-title">One-Minute Drill</div><div class="value-desc">The #1 evidence-based drill for clean chord changes</div></div>' +
    '<div class="value-item"><div class="value-icon">🎵</div><div class="value-title">Real-Time Detection</div><div class="value-desc">Your browser becomes a tuner and pitch detector — zero setup</div></div>' +
    '<div class="value-item"><div class="value-icon">🇬🇭</div><div class="value-title">Ghanaian Songs</div><div class="value-desc">Learn with Sarkodie, King Promise, Joe Mettle & more</div></div>' +
    '</div>' +
    '</div>' +

    '<div class="divider"></div>' +

    '<div class="section">' +
    '<div class="section-title"><em>Here Is Exactly</em> What You Get</div>' +
    '<div class="features">' +
    '<li>64 video lessons — each with a YouTube tutorial</li>' +
    '<li>15+ Ghanaian songs — full chord charts and progressions</li>' +
    '<li>Interactive fretboard — click any fret, see any chord</li>' +
    '<li>Real-time pitch detection — tuner + chord checker</li>' +
    '<li>One-minute change drill — the fastest way to clean transitions</li>' +
    '<li>Structured 20-minute practice sessions — warmup, drill, song, free play</li>' +
    '<li>Spaced repetition review — automatic scheduling</li>' +
    '<li>Chord trainer flashcards — build muscle memory fast</li>' +
    '<li>Strum pattern animator — visual down/up patterns at any BPM</li>' +
    '<li>Song auto-advance player — chord changes timed for you</li>' +
    '<li>Progress dashboard — XP, streaks, leaderboard</li>' +
    '<li>Metronome + built-in tuner</li>' +
    '<li>Scientific framework — deliberate practice, interleaving, Pareto 80/20</li>' +
    '<li><strong>Lifetime access</strong> — one payment, forever</li>' +
    '</div>' +
    '</div>' +

    '<div class="divider"></div>' +

    '<div class="section center">' +
    '<div class="section-title"><em>Invest in Your</em> Guitar Journey</div>' +
    '<div class="pricing-card">' +
    '<div class="pricing-old">GH₵ 500</div>' +
    '<div class="pricing-amount">GH¢ 299</div>' +
    '<div class="pricing-label">One-time payment — lifetime access — no hidden fees</div>' +
    '<div class="pricing-urgency">⚡ Launch price — lock it in now</div>' +
    '<div class="features" style="text-align:left;max-width:300px;margin:16px auto">' +
    '<li>All 16 modules (64 lessons)</li>' +
    '<li>Full Ghanaian song library (15+ songs)</li>' +
    '<li>Complete practice engine</li>' +
    '<li>Progress tracking and achievements</li>' +
    '<li>Lifetime updates</li>' +
    '</div>' +
    '<button class="btn btn-primary btn-lg btn-block" id="pricingBtn" onclick="startBuy()">Get Full Access — GH¢ 299 <span style="font-size:18px">→</span></button>' +
    '<div style="margin-top:12px;font-size:12px;color:#64748B"><a href="/school/guitar/learn/" style="color:#C9A84C">Start with Modules 1-3 free</a> — no credit card needed</div>' +
    '</div>' +
    '<div class="guarantee">' +
    '<div class="guarantee-icon">🛡️</div>' +
    '<div class="guarantee-text"><strong>Zero-Risk Start</strong> — Modules 1-3 are completely free. No credit card required. If it is not for you, walk away. If you love it, unlock everything for less than the cost of a single private lesson.</div>' +
    '</div>' +
    '</div>' +

    '<div class="divider"></div>' +

    '<div class="section">' +
    '<div class="section-title center"><em>Frequently Asked</em></div>' +
    faqHtml +
    '</div>' +

    '<div class="divider"></div>' +

    '<div class="section center">' +
    '<div class="section-title"><em>Your guitar is waiting.</em> Let us play.</div>' +
    '<div class="p" style="max-width:480px;margin:0 auto 24px">Join students who are finally learning the songs they love. Full access, lifetime updates, one payment.</div>' +
    '<button class="btn btn-primary btn-lg" id="finalBtn" onclick="startBuy()">Get Full Access — GH¢ 299 <span style="font-size:18px">→</span></button>' +
    '<div style="margin-top:12px;font-size:12px;color:#64748B"><a href="/school/guitar/learn/" style="color:#C9A84C">Start free</a> — Modules 1-3, no credit card</div>' +
    '</div>' +

    '<div style="height:40px"></div>' +
    '</div>' +

    '<div class="sticky-cta show" id="stickyCta">' +
    '<button class="btn btn-primary btn-block" id="stickyBtn" onclick="startBuy()">Get Full Access — GH¢ 299 <span style="font-size:18px">→</span></button>' +
    '</div>' +

    '<script>' +
    'var SLUG = "guitar-method";' +
    'var COURSE_NAME = "Gideon Guitar Method";' +
    'var COURSE_PRICE = 299;' +
    'function toggleFaq(i){var a=document.getElementById("faq"+i);var s=a.previousElementSibling.querySelector(".faq-arrow");a.classList.toggle("open");s.textContent=a.classList.contains("open")?"−":"+";}' +
    'function startBuy(){' +
    '  var email = prompt("Enter your email to continue:");' +
    '  if (!email || !email.includes("@")) return;' +
    '  var name = prompt("Enter your full name:");' +
    '  if (!name) return;' +
    '  var btn = document.getElementById("heroBtn") || document.getElementById("pricingBtn") || document.getElementById("finalBtn") || document.getElementById("stickyBtn");' +
    '  if (btn) { btn.disabled = true; btn.textContent = "Opening..."; }' +
    '  var tx_ref = "guitar_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,8);' +
    '  try{fetch("/api/track",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({event:"purchase_started",tx_ref:tx_ref,amount:COURSE_PRICE,email:email,name:name,campaign:SLUG})})}catch(e){}' +
    '  FlutterwaveCheckout({' +
    '    public_key: "' + flwPublicKey + '",' +
    '    tx_ref: tx_ref,' +
    '    amount: COURSE_PRICE,' +
    '    currency: "GHS",' +
    '    country: "GH",' +
    '    payment_options: "mobilemoneyghana,card,ussd",' +
    '    customer: { email: email, name: name },' +
    '    callback: function(p){' +
    '      if (p.status === "completed" || p.status === "successful") {' +
    '        window.location.href = "/school/guitar/learn/?purchased=1&tx_ref=" + p.tx_ref;' +
    '      }' +
    '    },' +
    '    onclose: function(){ if(btn){btn.disabled=false;btn.textContent="Get Full Access — GH¢ 299 \u2192";} }' +
    '  });' +
    '}' +
    '</script>' +

    '<script type="application/ld+json">' +
    JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      "name": "Gideon Guitar Method",
      "description": "16 modules, 64 video lessons. Learn to play your favorite Ghanaian songs on guitar with real-time pitch detection and deliberate practice system.",
      "image": "https://gideonabochie.org/assets/img/guitar-og.jpg",
      "brand": { "@type": "Brand", "name": "GideonAbochie Studio" },
      "offers": {
        "@type": "Offer",
        "price": "299",
        "priceCurrency": "GHS",
        "availability": "https://schema.org/InStock",
        "url": pageUrl,
        "priceValidUntil": "2027-06-12"
      },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.8",
        "reviewCount": "12",
        "bestRating": "5"
      }
    }) +
    '</script>' +

    '<script type="application/ld+json">' +
    JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqs.map(function(f) {
        return { "@type": "Question", "name": f.q, "acceptedAnswer": { "@type": "Answer", "text": f.a } };
      })
    }) +
    '</script>' +

    '</body></html>';

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html;charset=utf-8' }
  });
}
