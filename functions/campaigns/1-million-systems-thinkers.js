var esc = function(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); };
var fmt = function(n) { return 'GH\u00a2 ' + Number(n || 0).toLocaleString(); };
var fmtDate = function(d) {
  if (!d) return '';
  var p = d.split(/[-T]/);
  if (p.length < 3) return d;
  return p[2] + ' ' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(p[1])-1] + ' ' + p[0];
};

export async function onRequest(context) {
  var { env } = context;
  if (!env.DB) return new Response('Service unavailable', { status: 503 });

  try {
    var campaign = await env.DB.prepare(
      "SELECT *, COALESCE((SELECT SUM(amount) FROM donations WHERE campaign_id = campaigns.id AND status = 'successful'), 0) as raised_amount FROM campaigns WHERE slug = '1-million-systems-thinkers'"
    ).first();

    if (!campaign) {
      return new Response('Campaign not found', { status: 404, headers: { 'Content-Type': 'text/plain' } });
    }

    var pct = campaign.goal_amount > 0 ? Math.min(100, Math.round((campaign.raised_amount / campaign.goal_amount) * 100)) : 0;
    var raised = campaign.raised_amount || 0;
    var goal = campaign.goal_amount || 1000000;

    var recent = await env.DB.prepare(
      "SELECT donor_name, amount, created_at FROM donations WHERE campaign_id = ? AND status = 'successful' ORDER BY created_at DESC LIMIT 20"
    ).bind(campaign.id).all();

    var donorCountRow = await env.DB.prepare(
      "SELECT COUNT(DISTINCT donor_email) as c FROM donations WHERE campaign_id = ? AND status = 'successful'"
    ).bind(campaign.id).first();

    var donors = (recent.results || []);
    var donorTotal = (donorCountRow && donorCountRow.c) || 0;

    var donorRows = donors.slice(0, 8).map(function(d) {
      return '<tr><td>' + esc(d.donor_name || 'Anonymous') + '</td><td>' + fmt(d.amount) + '</td><td>' + fmtDate(d.created_at) + '</td></tr>';
    }).join('') || '<tr><td colspan="3" style="color:#4A5F7A;text-align:center;padding:20px;font-size:13px">No donations yet. Be the first!</td></tr>';

    var pageUrl = 'https://gideonabochie.org/campaigns/1-million-systems-thinkers';

    // Impact tier data
    var tiers = [
      { amt: 50, label: 'Starter', desc: 'Covers learning materials, exam fees, and a Certificate of Completion for 1 youth.' },
      { amt: 100, label: 'Scholar', desc: 'Trains 1 youth for a full semester — tuition, materials, mentorship, and certification.' },
      { amt: 500, label: 'Champion', desc: 'Trains 5 youth as a small cohort. Includes group mentorship and project showcase.' },
      { amt: 1000, label: 'Patron', desc: 'Trains 10 youth — a full classroom. Name listed on campaign donor wall.' },
      { amt: 5000, label: 'Founding Partner', desc: 'Trains 50+ youth. Featured on our website, annual report, and social media. Co-brand impact reports.' },
    ];

    var tierCards = tiers.map(function(t) {
      return '<div class="tier-card" data-amt="' + t.amt + '" onclick="pickTier(this)">' +
        '<div class="tier-amt">' + fmt(t.amt) + '</div>' +
        '<div class="tier-label">' + esc(t.label) + '</div>' +
        '<div class="tier-desc">' + esc(t.desc) + '</div>' +
        '<div class="tier-impact">' + Math.round(t.amt / 100) + ' youth trained</div>' +
        '</div>';
    }).join('');

    var faqs = [
      { q: 'How are the funds used?', a: '100% of donations fund our Systems Thinking curriculum: curriculum development (20%), trainer stipends (35%), learning materials (25%), digital platform (15%), and admin/operations (5%). Every GH\u00a2100 trains one youth for a full semester.' },
      { q: 'Who gets trained?', a: 'Ghanaian youth aged 15-35 across all 16 regions. We prioritize underserved communities, young women, and persons with disabilities through targeted outreach and scholarships.' },
      { q: 'Is this a government program?', a: 'No, this is a citizen-led initiative by GideonAbochie Studio. We collaborate with schools, churches, mosques, district assemblies, and CSOs to reach youth where they already gather.' },
      { q: 'How do I know my donation was received?', a: 'You will receive an email receipt immediately after payment. A formal tax-deductible invoice is also available on request.' },
      { q: 'Can I donate anonymously?', a: 'Yes. Leave the name field blank during checkout and you will appear as "Anonymous" on the donor wall.' },
      { q: 'Can I donate in USD or other currencies?', a: 'Flutterwave accepts Visa, Mastercard, Mobile Money (Ghana), and bank transfers in GHS. For USD or international wire transfers, email partnerships@gideonabochie.org.' },
    ];

    var faqHtml = faqs.map(function(f, i) {
      return '<div class="faq-item"><button class="faq-q" onclick="toggleFaq(' + i + ')" aria-expanded="false">' + esc(f.q) + '<span class="faq-arrow">+</span></button><div class="faq-a" id="faq' + i + '">' + esc(f.a) + '</div></div>';
    }).join('');

    var html = '<!DOCTYPE html><html lang="en"><head>' +
      '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Train 1 Million Ghanaian Youth in Systems Thinking — Flagship Campaign</title>' +
      '<meta name="description" content="A national movement to equip 1,000,000 Ghanaian youth with systems thinking, problem-solving, and AI-era skills. Every GH\u00a2100 trains one youth for a full semester.">' +
      '<meta property="og:title" content="Train 1 Million Youth in Systems Thinking">' +
      '<meta property="og:description" content="Join the movement to equip 1,000,000 Ghanaian youth with the skills to shape Ghana\u2019s future. Every GH\u00a2100 trains one youth for a semester.">' +
      '<meta property="og:image" content="https://gideonabochie.org/assets/images/og-image.png">' +
      '<meta property="og:url" content="' + pageUrl + '">' +
      '<meta property="og:type" content="website">' +
      '<meta name="twitter:card" content="summary_large_image"><link rel="canonical" href="' + pageUrl + '">' +
      '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Campaign","name":"Train 1 Million Ghanaian Youth in Systems Thinking","description":"A national movement to equip 1,000,000 Ghanaian youth with systems thinking, problem-solving, and AI-era skills. Every GH\u00a2100 trains one youth for a full semester.","url":"' + pageUrl + '","image":"https://gideonabochie.org/assets/images/og-image.png","status":"https://schema.org/ActiveActionStatus","fundingGoal":{"@type":"MonetaryAmount","currency":"GHS","value":"' + (campaign.goal_amount || 1000000) + '"},"amountRaised":{"@type":"MonetaryAmount","currency":"GHS","value":"' + (campaign.raised_amount || 0) + '"},"sponsor":{"@type":"Organization","name":"GideonAbochie Studio","url":"https://gideonabochie.org/"},"eligibleRegion":{"@type":"Country","name":"GH"}}</script>' +
      '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
      '<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">' +
      '<script src="https://checkout.flutterwave.com/v3.js"></script>' +
      '<style>' +
      ':root{--gold:#C9A84C;--gold-dark:#A68A2E;--bg:#0A1628;--bg2:#0F1F35;--bg3:#132642;--text:#CDD5E0;--muted:#6B7F9A;--dim:#4A5F7A;--border:#1E3456;--green:#34C77B;--red:#E8637A;--radius:12px}' +
      '*,*:before,*:after{box-sizing:border-box}' +
      'body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,sans-serif;line-height:1.5}' +
      '.hero{position:relative;background:linear-gradient(135deg,#0A1628 0%,#0F1F35 40%,#132642 70%,#0A1628 100%);overflow:hidden;padding:60px 20px 50px;text-align:center}' +
      '.hero:before{content:"";position:absolute;top:-50%;left:-50%;width:200%;height:200%;background:radial-gradient(ellipse at 30% 50%,rgba(201,168,76,0.06) 0%,transparent 60%),radial-gradient(ellipse at 70% 50%,rgba(52,199,123,0.04) 0%,transparent 60%);pointer-events:none}' +
      '.hero-badge{display:inline-block;padding:5px 14px;background:rgba(201,168,76,0.12);border:1px solid rgba(201,168,76,0.2);border-radius:20px;font-size:11px;font-weight:600;color:var(--gold);text-transform:uppercase;letter-spacing:.12em;margin-bottom:16px}' +
      '.hero h1{font-family:Barlow Condensed,sans-serif;font-size:clamp(36px,7vw,64px);font-weight:800;color:#fff;margin:0 auto 12px;max-width:800px;line-height:1.05;letter-spacing:-.02em}' +
      '.hero h1 em{color:var(--gold);font-style:normal}' +
      '.hero .sub{font-size:clamp(15px,2.2vw,18px);color:var(--muted);max-width:620px;margin:0 auto 28px;line-height:1.6}' +
      '.hero .sub strong{color:var(--text)}' +
      '.hero-stats{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:28px}' +
      '.hero-stat{padding:12px 24px;background:rgba(15,31,53,0.8);border:1px solid var(--border);border-radius:8px;min-width:120px}' +
      '.hero-stat .num{font-family:Barlow Condensed,sans-serif;font-size:28px;font-weight:700;color:var(--gold);line-height:1}' +
      '.hero-stat .lbl{font-size:10px;color:var(--dim);text-transform:uppercase;letter-spacing:.1em;margin-top:4px}' +
      '.hero .btn-primary{display:inline-block;padding:16px 48px;background:var(--gold);color:#0A1628;border:none;border-radius:8px;font-family:Barlow Condensed,sans-serif;font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:.15em;cursor:pointer;text-decoration:none;transition:background .2s,transform .15s}' +
      '.hero .btn-primary:hover{background:var(--gold-dark);transform:translateY(-1px)}' +
      '.hero .btn-primary:active{transform:translateY(0)}' +
      '.hero .secure-note{font-size:11px;color:var(--dim);margin-top:10px}' +
      '.section{max-width:900px;margin:0 auto;padding:50px 20px}' +
      '.section h2{font-family:Barlow Condensed,sans-serif;font-size:clamp(26px,4vw,36px);color:#fff;margin:0 0 8px;text-align:center}' +
      '.section h2 .hl{color:var(--gold)}' +
      '.section .lead{text-align:center;color:var(--muted);font-size:15px;max-width:600px;margin:0 auto 36px;line-height:1.6}' +
      '.problem-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:36px}' +
      '.problem-card{background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:24px;text-align:center}' +
      '.problem-card .icon{font-size:36px;margin-bottom:8px}' +
      '.problem-card h3{font-family:Barlow Condensed,sans-serif;font-size:18px;color:#fff;margin:0 0 6px}' +
      '.problem-card p{font-size:13px;color:var(--muted);margin:0;line-height:1.6}' +
      '.vision-box{background:linear-gradient(135deg,var(--bg2),var(--bg3));border:1px solid var(--gold);border-radius:var(--radius);padding:32px;text-align:center;max-width:700px;margin:0 auto}' +
      '.vision-box blockquote{font-size:16px;color:var(--text);font-style:italic;margin:0 0 12px;line-height:1.7}' +
      '.vision-box cite{font-size:12px;color:var(--muted);font-style:normal}' +
      '.tier-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-bottom:36px}' +
      '.tier-card{background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:20px 16px;text-align:center;cursor:pointer;transition:border-color .2s,transform .15s;position:relative}' +
      '.tier-card:hover{border-color:var(--gold);transform:translateY(-2px)}' +
      '.tier-card.selected{border-color:var(--gold);background:rgba(201,168,76,0.08)}' +
      '.tier-card .tier-amt{font-family:Barlow Condensed,sans-serif;font-size:28px;font-weight:700;color:var(--gold);line-height:1}' +
      '.tier-card .tier-label{font-size:11px;color:var(--dim);text-transform:uppercase;letter-spacing:.12em;margin:4px 0 6px}' +
      '.tier-card .tier-desc{font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:8px}' +
      '.tier-card .tier-impact{display:inline-block;padding:2px 10px;background:rgba(52,199,123,0.12);border-radius:4px;font-size:10px;font-weight:600;color:var(--green);text-transform:uppercase;letter-spacing:.05em}' +
      '.donate-box{background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:32px;max-width:500px;margin:0 auto}' +
      '.donate-box input{width:100%;padding:12px 16px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:#fff;font-size:14px;margin-bottom:10px;font-family:Inter,sans-serif;outline:none;transition:border-color .2s}' +
      '.donate-box input:focus{border-color:var(--gold)}' +
      '.donate-box .row{display:flex;gap:10px}' +
      '.donate-box .row input{flex:1}' +
      '.donate-box .btn{width:100%;padding:14px;background:var(--gold);color:#0A1628;border:none;border-radius:8px;font-family:Barlow Condensed,sans-serif;font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:.15em;cursor:pointer;transition:background .2s}' +
      '.donate-box .btn:hover{background:var(--gold-dark)}' +
      '.donate-box .btn:disabled{opacity:.5;cursor:not-allowed}' +
      '.progress-bar-wrap{height:8px;background:var(--bg);border-radius:4px;overflow:hidden;margin-bottom:8px}' +
      '.progress-bar-fill{height:100%;border-radius:4px;background:linear-gradient(90deg,var(--gold),#D4B85A);transition:width .8s ease}' +
      '.progress-labels{display:flex;justify-content:space-between;font-size:11px;color:var(--dim);margin-bottom:20px}' +
      '.donor-table{width:100%;border-collapse:collapse;font-size:13px}' +
      '.donor-table th{padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--dim);border-bottom:1px solid var(--border)}' +
      '.donor-table td{padding:10px 12px;border-bottom:1px solid rgba(30,52,86,.4)}' +
      '.faq-list{max-width:650px;margin:0 auto}' +
      '.faq-item{border-bottom:1px solid var(--border)}' +
      '.faq-q{width:100%;padding:16px 0;background:none;border:none;color:var(--text);font-size:14px;font-weight:500;text-align:left;cursor:pointer;display:flex;justify-content:space-between;align-items:center;font-family:Inter,sans-serif}' +
      '.faq-q:hover{color:var(--gold)}' +
      '.faq-q .faq-arrow{font-size:18px;color:var(--gold);transition:transform .2s}' +
      '.faq-q[aria-expanded=true] .faq-arrow{transform:rotate(45deg)}' +
      '.faq-a{padding:0 0 16px;font-size:13px;color:var(--muted);line-height:1.7;display:none}' +
      '.faq-a.open{display:block}' +
      '.share-bar{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:32px}' +
      '.share-bar a{display:inline-flex;align-items:center;gap:6px;padding:10px 20px;border:1px solid var(--border);border-radius:8px;font-size:12px;color:var(--muted);text-decoration:none;transition:border-color .2s,color .2s}' +
      '.share-bar a:hover{border-color:var(--gold);color:var(--gold)}' +
      '.sticky-cta{display:none;position:fixed;bottom:0;left:0;right:0;background:var(--bg2);border-top:1px solid var(--border);padding:12px 20px;z-index:100;text-align:center}' +
      '.sticky-cta button{padding:12px 36px;background:var(--gold);color:#0A1628;border:none;border-radius:8px;font-family:Barlow Condensed,sans-serif;font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;cursor:pointer;width:100%;max-width:400px}' +
      '@media(max-width:640px){.problem-grid{grid-template-columns:1fr}.tier-grid{grid-template-columns:1fr 1fr}.hero{padding:40px 16px 36px}.hero h1{font-size:32px}.sticky-cta{display:block}.section{padding:36px 16px}}' +
      '</style>' +
      '</head><body>' +
      '<div style="text-align:center;padding:24px 20px 0"><img src="/assets/images/campaign-logo.png" alt="GideonAbochie Studio" style="height:44px;width:auto;opacity:1;filter:brightness(1.15)"></div>' +
      '<!-- HERO -->' +
      '<div class="hero"><div class="hero-badge">Flagship Campaign</div>' +
      '<h1>Train <em>1 Million</em> Systems Thinking Ghanaian Youth</h1>' +
      '<p class="sub">A generation-defining mission to equip <strong>1,000,000 Ghanaian youth</strong> with systems thinking, problem-solving, and AI-era skills. Every <strong>GH\u00a2100</strong> trains one youth for a full semester.</p>' +
      '<div class="hero-stats">' +
      '<div class="hero-stat"><div class="num">' + fmt(raised) + '</div><div class="lbl">Raised</div></div>' +
      '<div class="hero-stat"><div class="num">' + fmt(goal) + '</div><div class="lbl">Goal</div></div>' +
      '<div class="hero-stat"><div class="num">' + pct + '%</div><div class="lbl">Progress</div></div>' +
      '<div class="hero-stat"><div class="num">' + donorTotal + '</div><div class="lbl">Donors</div></div>' +
      '</div>' +
      '<a class="btn-primary" href="#donate">Support This Mission</a>' +
      '<div class="secure-note">&#128274; Secured by Flutterwave &bull; Mobile Money, Card, Bank</div>' +
      '</div>' +
      '<!-- THE WHY -->' +
      '<div class="section" id="why">' +
      '<h2>Why <span class="hl">Systems Thinking</span>?</h2>' +
      '<p class="lead">Ghana has the youngest population in the world — 57% under 25. The question is not whether they will inherit the future, but whether we will prepare them to build it.</p>' +
      '<div class="problem-grid">' +
      '<div class="problem-card"><div class="icon">\u{1F4CA}</div><h3>The Youth Bulge</h3><p>12 million Ghanaian youth will enter the workforce by 2040. Without systemic intervention, unemployment will deepen. Systems thinking gives them the tools to create, not just seek, opportunities.</p></div>' +
      '<div class="problem-card"><div class="icon">\u{1F504}</div><h3>Skills Gap</h3><p>Our education system was designed for the industrial age. Youth need computational thinking, problem reframing, and adaptive learning — skills that transfer across any career in the AI era.</p></div>' +
      '<div class="problem-card"><div class="icon">\u{1F30D}</div><h3>National Scale</h3><p>One million trained youth means transformed communities across all 16 regions. Each trained youth becomes a multiplier — teaching others, starting ventures, and solving local problems.</p></div>' +
      '<div class="problem-card"><div class="icon">\u{1F3AF}</div><h3>Inclusive Future</h3><p>We prioritize underserved communities, young women, and persons with disabilities. Systems thinking is not a luxury for the few — it is the birthright of every Ghanaian youth.</p></div>' +
      '</div>' +
      '<div class="vision-box"><blockquote>"The most powerful way to change a nation is to change how its people think. Systems thinking gives a young person the lens to see root causes, the courage to question assumptions, and the creativity to build solutions their community actually needs."</blockquote><cite>— Gideon Abochie, Founder</cite></div>' +
      '</div>' +
      '<!-- IMPACT TIERS -->' +
      '<div class="section" id="donate" style="background:var(--bg2);max-width:100%;padding:50px 20px">' +
      '<div style="max-width:900px;margin:0 auto">' +
      '<h2>Choose Your <span class="hl">Impact</span></h2>' +
      '<p class="lead">Every contribution, whatever the size, trains a young Ghanaian to think, build, and lead. Pick an impact tier or enter a custom amount below.</p>' +
      '<div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:' + Math.min(pct, 100) + '%"></div></div>' +
      '<div class="progress-labels"><span>' + fmt(raised) + ' raised</span><span>' + pct + '% of ' + fmt(goal) + '</span></div>' +
      '<div class="tier-grid">' + tierCards + '</div>' +
      '<div class="donate-box" id="donateBox">' +
      '<div class="row"><input type="text" id="dnName" placeholder="Your name (or leave blank for anonymous)" autocomplete="name">' +
      '<input type="email" id="dnEmail" placeholder="Your email *" autocomplete="email"></div>' +
      '<div class="row"><input type="tel" id="dnPhone" placeholder="Phone (optional)" autocomplete="tel">' +
      '<input type="number" id="dnAmount" placeholder="Amount (GHS)" min="5" step="any"></div>' +
      '<button class="btn" id="dnBtn" onclick="startDonate()">Donate Now</button>' +
      '<div style="font-size:11px;color:var(--dim);text-align:center;margin-top:8px">&#128274; Secured by Flutterwave &bull; Mobile Money &bull; Card &bull; Bank Transfer</div>' +
      '</div>' +
      '</div></div>' +
      '<!-- DONORS -->' +
      '<div class="section" id="donors">' +
      '<h2>Join <span class="hl">' + donorTotal + '</span> Donors</h2>' +
      '<p class="lead">Every donor is a partner in building Ghana\'s future. Recent contributions:</p>' +
      '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:20px;max-width:600px;margin:0 auto">' +
      '<table class="donor-table"><thead><tr><th>Donor</th><th>Amount</th><th>Date</th></tr></thead><tbody>' + donorRows + '</tbody></table>' +
      '</div></div>' +
      '<!-- FAQ -->' +
      '<div class="section" id="faq" style="background:var(--bg2);max-width:100%;padding:50px 20px">' +
      '<div style="max-width:650px;margin:0 auto">' +
      '<h2>Frequently Asked <span class="hl">Questions</span></h2>' +
      '<p class="lead">Everything you need to know before you donate.</p>' +
      '<div class="faq-list">' + faqHtml + '</div>' +
      '</div></div>' +
      '<!-- SHARE -->' +
      '<div class="section" style="text-align:center;padding:30px 20px">' +
      '<p style="font-size:13px;color:var(--muted);margin:0 0 12px">Know someone who cares about Ghana\'s future? Share this mission:</p>' +
      '<div class="share-bar">' +
      '<a href="https://twitter.com/intent/tweet?text=' + encodeURIComponent('I\'m supporting the mission to train 1 MILLION Ghanaian youth in systems thinking. Join me:') + '&url=' + encodeURIComponent(pageUrl) + '" target="_blank" rel="noopener"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>Tweet</a>' +
      '<a href="https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(pageUrl) + '" target="_blank" rel="noopener"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>Share</a>' +
      '<a href="https://wa.me/?text=' + encodeURIComponent('Join me in training 1 MILLION Ghanaian youth in systems thinking: ' + pageUrl) + '" target="_blank" rel="noopener"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>WhatsApp</a>' +
      '<a href="mailto:?subject=' + encodeURIComponent('Train 1 Million Ghanaian Youth in Systems Thinking') + '&body=' + encodeURIComponent('I am supporting this campaign to train 1 million Ghanaian youth in systems thinking. Join me: ' + pageUrl) + '"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>Email</a>' +
      '</div></div>' +
      '<!-- STICKY CTA -->' +
      '<div class="sticky-cta"><button onclick="document.getElementById(\'donate\').scrollIntoView({behavior:\'smooth\'})">Donate Now — Every GH\u00a2100 Trains 1 Youth</button></div>' +
      '<script>' +
      'var FLW_KEY="FLWPUBK-6b8e97034170a30c3e07c20e4eab58af-X";' +
      'var SLUG="1-million-systems-thinkers";' +
      'function pickTier(el){' +
      'document.querySelectorAll(".tier-card.selected").forEach(function(c){c.classList.remove("selected")});' +
      'el.classList.add("selected");' +
      'document.getElementById("dnAmount").value=el.getAttribute("data-amt");' +
      'document.getElementById("donate").scrollIntoView({behavior:"smooth",block:"start"});' +
      '}' +
      'function toggleFaq(i){' +
      'var btn=event.currentTarget;' +
      'var answer=document.getElementById("faq"+i);' +
      'var isOpen=answer.classList.contains("open");' +
      'document.querySelectorAll(".faq-a.open").forEach(function(a){a.classList.remove("open")});' +
      'document.querySelectorAll(".faq-q[aria-expanded=true]").forEach(function(b){b.setAttribute("aria-expanded","false")});' +
      'if(!isOpen){answer.classList.add("open");btn.setAttribute("aria-expanded","true")}' +
      '}' +
      'function startDonate(){' +
      'var name=document.getElementById("dnName").value.trim();' +
      'var email=document.getElementById("dnEmail").value.trim();' +
      'var phone=document.getElementById("dnPhone").value.trim();' +
      'var amt=parseFloat(document.getElementById("dnAmount").value);' +
      'if(!email||!email.includes("@")){alert("Please enter a valid email");return}' +
      'if(!amt||amt<5){alert("Minimum donation is GHS 5");return}' +
      'var btn=document.getElementById("dnBtn");btn.disabled=true;btn.textContent="Opening Payment...";' +
      'var tx_ref="camp_"+SLUG+"_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8);' +
      'FlutterwaveCheckout({' +
      'public_key:FLW_KEY,tx_ref:tx_ref,amount:amt,currency:"GHS",' +
      'payment_options:"card,mobilemoneyghana,ussd",' +
      'customer:{email:email,name:name||"Anonymous",phone:phone},' +
      'meta:{campaign_slug:SLUG},' +
      'customizations:{title:"GideonAbochie Studio",description:"Train 1M Systems Thinkers",logo:window.location.origin+"/assets/images/logo.png"},' +
      'callback:function(p){' +
      'if(p.status==="successful"||p.transaction_id){' +
      'window.location.href="/campaigns/1-million-systems-thinkers?thankyou=1";' +
      '}' +
      '},' +
      'onclose:function(){btn.disabled=false;btn.textContent="Donate Now"}' +
      '})}' +
      'if(location.search.indexOf("thankyou=1")>=0){' +
      'document.getElementById("donateBox").innerHTML="' +
      '<div style=\\"text-align:center;padding:20px\\">' +
      '<div style=\\"font-size:48px;margin-bottom:8px\\">\\u2713</div>' +
      '<h3 style=\\"font-family:Barlow Condensed,sans-serif;font-size:22px;color:#34C77B;margin:0 0 4px\\">Thank You!</h3>' +
      '<p style=\\"font-size:14px;color:#6B7F9A;margin:0 0 4px\\">Your contribution is powering the next generation of systems thinkers.</p>' +
      '<p style=\\"font-size:12px;color:#4A5F7A\\">A receipt will be sent to your email.</p>' +
      '<a href=\\"/campaigns/1-million-systems-thinkers\\" style=\\"display:inline-block;margin-top:12px;color:#C9A84C;font-size:13px\\">&larr; Back to campaign</a>' +
      '</div>";' +
      '}' +
      '</script>' +
      '</body></html>';

    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html;charset=utf-8' } });
  } catch (err) {
    return new Response('Internal error', { status: 500, headers: { 'Content-Type': 'text/plain' } });
  }
}
