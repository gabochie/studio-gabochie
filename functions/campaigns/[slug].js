function esc(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

function formatDate(d) {
  if (!d) return '';
  var p = d.split(/[-T]/);
  if (p.length < 3) return d;
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return p[2] + ' ' + months[parseInt(p[1])-1] + ' ' + p[0];
}

function fmtAmount(n, cur) {
  var sym = cur === 'GHS' ? 'GH\u00a2' : (cur === 'USD' ? '$' : cur + ' ');
  return sym + ' ' + Number(n || 0).toLocaleString();
}

export async function onRequest(context) {
  var { request, env, params } = context;
  var slug = params && params.slug;
  if (!slug) return new Response('Not found', { status: 404 });
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  if (!env.DB) return new Response('Service unavailable', { status: 503 });

  try {
    var campaign = await env.DB.prepare(
      "SELECT *, COALESCE((SELECT SUM(amount) FROM donations WHERE campaign_id = campaigns.id AND status = 'successful'), 0) as raised_amount FROM campaigns WHERE slug = ?"
    ).bind(slug).first();

    if (!campaign) {
      var notFoundHtml = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Campaign Not Found — GideonAbochie Studio</title><style>body{font-family:Inter,sans-serif;background:#0A1628;color:#CDD5E0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center}.card{background:#0F1F35;border:1px solid #1E3456;border-radius:12px;padding:48px;max-width:400px}h1{font-family:Barlow Condensed,sans-serif;color:#fff;margin:0 0 8px}p{color:#6B7F9A;margin:0 0 24px}a{color:#C9A84C;text-decoration:none}</style></head><body><div class="card"><h1>Campaign Not Found</h1><p>The campaign you are looking for does not exist or has ended.</p><a href="/campaigns/">&larr; View All Campaigns</a></div></body></html>';
      return new Response(notFoundHtml, { status: 404, headers: { 'Content-Type': 'text/html;charset=utf-8' } });
    }

    var pct = campaign.goal_amount > 0 ? Math.min(100, Math.round((campaign.raised_amount / campaign.goal_amount) * 100)) : 0;
    var isComplete = pct >= 100;
    var isActive = campaign.status === 'active';

    var recentDonations = await env.DB.prepare(
      "SELECT donor_name, amount, currency, created_at FROM donations WHERE campaign_id = ? AND status = 'successful' ORDER BY created_at DESC LIMIT 20"
    ).bind(campaign.id).all();

    var donorCount = await env.DB.prepare(
      "SELECT COUNT(DISTINCT donor_email) as c FROM donations WHERE campaign_id = ? AND status = 'successful'"
    ).bind(campaign.id).first();

    var donations = (recentDonations.results || []);
    var donorTotal = (donorCount && donorCount.c) || 0;
    var currency = campaign.currency || 'GHS';
    var pageTitle = esc(campaign.name) + ' — GideonAbochie Studio Fundraising';
    var pageDesc = esc((campaign.description || '').substring(0, 200));
    var pageUrl = 'https://gideonabochie.org/campaigns/' + esc(slug);
    var imgUrl = campaign.cover_image || 'https://gideonabochie.org/assets/images/og-image.png';

    var barClass = isComplete ? 'complete' : (isActive ? '' : 'inactive');
    var statusLabel = isComplete ? 'Goal Reached' : (isActive ? 'Active' : campaign.status);
    var donateRef = 'camp_' + slug;

    var donationRows = donations.slice(0, 10).map(function(d) {
      return '<tr><td>' + esc(d.donor_name || 'Anonymous') + '</td><td>' + fmtAmount(d.amount, d.currency || currency) + '</td><td>' + formatDate(d.created_at) + '</td></tr>';
    }).join('') || '<tr><td colspan="3" style="color:#4A5F7A;text-align:center;padding:20px;font-size:13px">No donations yet. Be the first!</td></tr>';

    var html = '<!DOCTYPE html><html lang="en"><head>' +
      '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + pageTitle + '</title>' +
      '<meta name="description" content="' + pageDesc + '">' +
      '<meta property="og:title" content="' + esc(campaign.name) + '">' +
      '<meta property="og:description" content="' + pageDesc + '">' +
      '<meta property="og:image" content="' + esc(imgUrl) + '">' +
      '<meta property="og:url" content="' + pageUrl + '">' +
      '<meta property="og:type" content="website">' +
      '<meta name="twitter:card" content="summary_large_image">' +
      '<link rel="canonical" href="' + pageUrl + '">' +
      '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Campaign","name":"' + esc(campaign.name) + '","description":"' + esc((campaign.description || '').substring(0, 300)) + '","url":"' + pageUrl + '","image":"' + esc(imgUrl) + '","status":"https://schema.org/ActiveActionStatus","fundingGoal":{"@type":"MonetaryAmount","currency":"' + currency + '","value":"' + (campaign.goal_amount || 0) + '"},"amountRaised":{"@type":"MonetaryAmount","currency":"' + currency + '","value":"' + (campaign.raised_amount || 0) + '"}}</script>' +
      '<link rel="preconnect" href="https://fonts.googleapis.com">' +
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
      '<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700&family=Courier+Prime:wght@400;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">' +
      '<link rel="stylesheet" href="/style.css">' +
      '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.1.0/dist/tabler-icons.min.css">' +
      '<style>' +
      ':root{--gold:#C9A84C;--gold-hover:#B8942F;--bg-dark:#0A1628;--bg-card:#0F1F35;--text-body:#CDD5E0;--text-muted:#6B7F9A;--text-dim:#4A5F7A;--border:#1E3456;--green:#34C77B;--red:#E8637A;--radius:12px}' +
      'body{background:var(--bg-dark);color:var(--text-body);font-family:Inter,sans-serif;margin:0;padding-top:60px}' +
      '.campaign-page{max-width:800px;margin:0 auto;padding:20px}' +
      '.cover-img{width:100%;height:240px;object-fit:cover;border-radius:var(--radius);background:var(--bg-card);margin-bottom:24px}' +
      '.no-cover{width:100%;height:240px;border-radius:var(--radius);background:linear-gradient(135deg,var(--bg-card),#0D1E33);display:flex;align-items:center;justify-content:center;margin-bottom:24px;font-family:Barlow Condensed,sans-serif;font-size:48px;color:var(--text-dim);letter-spacing:.05em}' +
      '.campaign-page h1{font-family:Barlow Condensed,sans-serif;font-size:36px;font-weight:700;color:#fff;margin:0 0 8px;line-height:1.1}' +
      '.campaign-page .desc{font-size:15px;color:var(--text-muted);line-height:1.7;margin:0 0 20px}' +
      '.meta-row{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px}' +
      '.meta-row .tag{display:inline-flex;align-items:center;gap:4px;padding:4px 12px;border-radius:4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;background:rgba(201,168,76,0.12);color:var(--gold)}' +
      '.meta-row .tag.green{background:rgba(52,199,123,0.12);color:var(--green)}' +
      '.meta-row .tag.inactive{background:rgba(232,99,122,0.12);color:var(--red)}' +
      '.progress-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:28px;margin-bottom:24px}' +
      '.progress-bar-wrap{height:14px;background:var(--bg-dark);border-radius:7px;overflow:hidden;margin-bottom:16px}' +
      '.progress-bar-fill{height:100%;border-radius:7px;transition:width .6s;background:linear-gradient(90deg,var(--gold),#D4B85A)}' +
      '.progress-bar-fill.complete{background:linear-gradient(90deg,var(--green),#5DEAA8)}' +
      '.progress-stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;text-align:center}' +
      '.progress-stats .stat-label{font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.12em;margin-bottom:4px}' +
      '.progress-stats .stat-value{font-family:Barlow Condensed,sans-serif;font-size:28px;font-weight:700;color:var(--gold);line-height:1}' +
      '.progress-stats .stat-value.complete{color:var(--green)}' +
      '.progress-stats .stat-value.muted{color:var(--text-body)}' +
      '.donation-table{width:100%;border-collapse:collapse;font-size:13px;margin-top:12px}' +
      '.donation-table th{padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--text-dim);border-bottom:1px solid var(--border)}' +
      '.donation-table td{padding:10px 12px;border-bottom:1px solid rgba(30,52,86,.4);color:var(--text-body)}' +
      '.donate-section{text-align:center;padding:32px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);margin-top:24px}' +
      '.donate-section .btn{display:inline-block;padding:14px 40px;background:var(--gold);color:var(--bg-dark);border:none;border-radius:8px;font-family:Barlow Condensed,sans-serif;font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;cursor:pointer;text-decoration:none;transition:background .2s}' +
      '.donate-section .btn:hover{background:var(--gold-hover)}' +
      '.donate-section .btn:disabled{opacity:.5;cursor:not-allowed}' +
      '.donate-inputs{max-width:400px;margin:0 auto 16px}' +
      '.donate-inputs input{width:100%;padding:12px 16px;background:var(--bg-dark);border:1px solid var(--border);border-radius:8px;color:#fff;font-size:14px;margin-bottom:10px;box-sizing:border-box;font-family:Inter,sans-serif;outline:none}' +
      '.donate-inputs input:focus{border-color:var(--gold)}' +
      '.donate-inputs .row{display:flex;gap:10px}' +
      '.donate-inputs .row input{flex:1}' +
      '.share-row{display:flex;gap:10px;justify-content:center;margin-top:16px}' +
      '.share-row a{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border:1px solid var(--border);border-radius:6px;font-size:12px;color:var(--text-muted);text-decoration:none;transition:border-color .2s}' +
      '.share-row a:hover{border-color:var(--gold);color:var(--gold)}' +
      '.back-link{display:inline-block;margin-bottom:20px;font-size:13px;color:var(--text-muted);text-decoration:none}' +
      '.back-link:hover{color:var(--gold)}' +
      '@media(max-width:600px){.campaign-page h1{font-size:28px}.progress-stats{grid-template-columns:1fr 1fr;gap:12px}.cover-img,.no-cover{height:160px}}' +
      '</style>' +
      '<script src="https://checkout.flutterwave.com/v3.js"></script>' +
      '</head><body>' +
      '<div id="nav-placeholder"></div>' +
      '<div class="campaign-page">' +
      '<a href="/campaigns/" class="back-link">&larr; All Campaigns</a>' +
      (campaign.cover_image
        ? '<img class="cover-img" src="' + esc(campaign.cover_image) + '" alt="' + esc(campaign.name) + '">'
        : '<div class="no-cover">' + esc(campaign.name.substring(0, 2).toUpperCase()) + '</div>') +
      '<h1>' + esc(campaign.name) + '</h1>' +
      (campaign.description ? '<p class="desc">' + esc(campaign.description) + '</p>' : '') +
      '<div class="meta-row">' +
      '<span class="tag ' + barClass + '">' + esc(statusLabel) + '</span>' +
      '<span class="tag">' + esc(campaign.type || 'fundraiser') + '</span>' +
      (campaign.end_date ? '<span class="tag">Ends ' + formatDate(campaign.end_date) + '</span>' : '') +
      (campaign.start_date ? '<span class="tag">Started ' + formatDate(campaign.start_date) + '</span>' : '') +
      '</div>' +
      '<div class="progress-card">' +
      '<div class="progress-bar-wrap"><div class="progress-bar-fill ' + barClass + '" style="width:' + Math.min(pct, 100) + '%"></div></div>' +
      '<div class="progress-stats">' +
      '<div><div class="stat-label">Raised</div><div class="stat-value ' + (isComplete ? 'complete' : '') + '">' + fmtAmount(campaign.raised_amount, currency) + '</div></div>' +
      '<div><div class="stat-label">Goal</div><div class="stat-value muted">' + fmtAmount(campaign.goal_amount, currency) + '</div></div>' +
      '<div><div class="stat-label">Donors</div><div class="stat-value muted">' + donorTotal + '</div></div>' +
      '</div></div>' +
      '<div class="progress-card">' +
      '<h3 style="font-family:Barlow Condensed,sans-serif;font-size:20px;color:#fff;margin:0 0 4px">Recent Donations</h3>' +
      '<table class="donation-table"><thead><tr><th>Donor</th><th>Amount</th><th>Date</th></tr></thead><tbody>' + donationRows + '</tbody></table>' +
      '</div>';

    if (isActive) {
      html += '<div class="donate-section" id="donateSection">' +
        '<h3 style="font-family:Barlow Condensed,sans-serif;font-size:22px;color:#fff;margin:0 0 4px">Support This Campaign</h3>' +
        '<p style="font-size:13px;color:var(--text-muted);margin:0 0 20px">Every contribution moves us closer to the goal.</p>' +
        '<div class="donate-inputs">' +
        '<div class="row"><input type="text" id="dnName" placeholder="Your name" autocomplete="name">' +
        '<input type="email" id="dnEmail" placeholder="Your email" autocomplete="email"></div>' +
        '<div class="row"><input type="tel" id="dnPhone" placeholder="Phone (optional)" autocomplete="tel">' +
        '<input type="number" id="dnAmount" placeholder="Amount (GHS)" min="5" value="50"></div>' +
        '</div>' +
        '<button class="btn" id="dnBtn" onclick="startDonate()">Donate Now</button>' +
        '<div class="secure-badge" style="font-size:11px;color:var(--text-dim);margin-top:12px">&#128274; Secured by Flutterwave</div>' +
        '</div>';
    }

    html += '<div class="share-row">' +
      '<a href="https://twitter.com/intent/tweet?text=' + encodeURIComponent('Support ' + campaign.name + ' — GideonAbochie Studio') + '&url=' + encodeURIComponent(pageUrl) + '" target="_blank" rel="noopener"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>Tweet</a>' +
      '<a href="https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(pageUrl) + '" target="_blank" rel="noopener"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>Share</a>' +
      '<a href="https://wa.me/?text=' + encodeURIComponent('Support ' + campaign.name + ' — ' + pageUrl) + '" target="_blank" rel="noopener"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>WhatsApp</a>' +
      '<a href="mailto:?subject=' + encodeURIComponent('Support ' + campaign.name) + '&body=' + encodeURIComponent('I am supporting this campaign: ' + pageUrl) + '"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>Email</a>' +
      '</div>' +
      '</div>' +
      '<div id="footer-placeholder"></div>' +
      '<script src="/nav.js"></script>' +
      '<script>' +
      'var FLW_KEY = "FLWPUBK-6b8e97034170a30c3e07c20e4eab58af-X";' +
      'var CAMPAIGN_SLUG = ' + JSON.stringify(slug) + ';' +
      'function startDonate(){' +
      'var name=document.getElementById("dnName").value.trim();' +
      'var email=document.getElementById("dnEmail").value.trim();' +
      'var phone=document.getElementById("dnPhone").value.trim();' +
      'var amt=parseFloat(document.getElementById("dnAmount").value);' +
      'if(!email||!email.includes("@")){alert("Please enter your email");return}' +
      'if(!name){alert("Please enter your name");return}' +
      'if(!amt||amt<5){alert("Minimum donation is GHS 5");return}' +
      'var btn=document.getElementById("dnBtn");btn.disabled=true;btn.textContent="Opening...";' +
      'var tx_ref="camp_"+CAMPAIGN_SLUG+"_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8);' +
      'FlutterwaveCheckout({' +
      'public_key:FLW_KEY,tx_ref:tx_ref,amount:amt,currency:"GHS",' +
      'payment_options:"card,mobilemoneyghana,ussd",' +
      'customer:{email:email,name:name,phone:phone},' +
      'meta:{campaign_slug:CAMPAIGN_SLUG},' +
      'customizations:{title:"GideonAbochie Studio",description:"Support: "+CAMPAIGN_SLUG,logo:window.location.origin+"/assets/images/logo.png"},' +
      'callback:function(payload){' +
      'if(payload.status==="successful"||payload.transaction_id){' +
      'window.location.href="/campaigns/"+CAMPAIGN_SLUG+"?thankyou=1";' +
      '}' +
      '},' +
      'onclose:function(){btn.disabled=false;btn.textContent="Donate Now"}' +
      '})}' +
      'if(location.search.indexOf("thankyou=1")>=0){' +
      'document.getElementById("donateSection").innerHTML=' +
      "'<div style=\"text-align:center;padding:40px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);margin-top:24px\">" +
      "<div style=\"font-size:48px;margin-bottom:8px\">\\u2713</div>" +
      "<h3 style=\"font-family:Barlow Condensed,sans-serif;font-size:22px;color:#34C77B;margin:0 0 4px\">Thank You!</h3>" +
      "<p style=\"font-size:14px;color:var(--text-muted);margin:0\">Your contribution has been received. You will receive a receipt by email.</p>" +
      "<a href=\"/campaigns/\" style=\"display:inline-block;margin-top:16px;color:var(--gold);font-size:13px\">&larr; Back to Campaigns</a>" +
      "</div>';" +
      '}' +
      '</script>' +
      '</body></html>';

    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html;charset=utf-8' } });
  } catch (err) {
    var errHtml = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Error — GideonAbochie Studio</title><style>body{font-family:Inter,sans-serif;background:#0A1628;color:#CDD5E0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center}.card{background:#0F1F35;border:1px solid #1E3456;border-radius:12px;padding:48px;max-width:400px}h1{font-family:Barlow Condensed,sans-serif;color:#fff;margin:0 0 8px}p{color:#6B7F9A;margin:0 0 24px}a{color:#C9A84C;text-decoration:none}</style></head><body><div class="card"><h1>Something Went Wrong</h1><p>Please try again later.</p><a href="/campaigns/">&larr; View All Campaigns</a></div></body></html>';
    return new Response(errHtml, { status: 500, headers: { 'Content-Type': 'text/html;charset=utf-8' } });
  }
}
