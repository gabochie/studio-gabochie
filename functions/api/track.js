function detectDevice(ua) {
  if (!ua) return 'Desktop';
  var lower = ua.toLowerCase();
  if (/(android|iphone|ipod|blackberry|windows phone|mobile|phone)/.test(lower) && !/ipad/.test(lower)) return 'Mobile';
  if (/(ipad|tablet|playbook|silk)|(android(?!.*mobile))/i.test(ua)) return 'Tablet';
  return 'Desktop';
}

function categorizeSource(referrer, hostname) {
  if (!referrer) return 'Direct';
  var lower = referrer.toLowerCase();
  if (lower.includes(hostname ? hostname.toLowerCase() : 'gideonabochie.org')) return 'Direct';
  var organic = [/google\./, /bing\./, /duckduckgo\./, /yahoo\./, /ecosia\./, /yandex\./, /baidu\./, /ask\./];
  for (var i = 0; i < organic.length; i++) { if (organic[i].test(lower)) return 'Organic'; }
  var social = [/facebook\./, /twitter\./, /x\.com/, /instagram\./, /linkedin\./, /tiktok\./, /youtube\./, /pinterest\./, /reddit\./, /whatsapp\./, /telegram\./, /discord\./];
  for (var j = 0; j < social.length; j++) { if (social[j].test(lower)) return 'Social'; }
  var email = [/mail\.google/, /outlook/, /mail\.yahoo/, /proton\.mail/, /mail\.aol/, /email/, /newsletter/];
  for (var k = 0; k < email.length; k++) { if (email[k].test(lower)) return 'Email'; }
  try {
    new URL(referrer);
    return 'Referral';
  } catch (_) {
    return 'Referral';
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
    const body = await request.json();
    const { page, referrer, event, tx_ref, amount, email, name, campaign } = body;
    const cf = request.cf || {};
    const ip = request.headers.get('CF-Connecting-IP') || '';
    const ua = request.headers.get('User-Agent') || '';

    if (!env.DB) {
      return new Response(JSON.stringify({ status: 'ok' }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (event) {
      // Custom event tracking (e.g. donation_started)
      await env.DB.prepare(
        'INSERT INTO events (event_type, event_data, page, email, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))'
      ).bind(
        event, JSON.stringify({ tx_ref, amount, name, campaign }),
        page || '/', email || ''
      ).run();
    } else {
      // Page view tracking
      var device = detectDevice(ua);
      var hostname = new URL(request.url).hostname;
      var source = categorizeSource(referrer, hostname);
      await env.DB.prepare(
        'INSERT INTO page_views (page, referrer, country, city, ip, device_type, user_agent, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        page || '/', referrer || '',
        cf.country || '', cf.city || '', ip,
        device, ua.slice(0,500), source
      ).run();
    }
    return new Response(JSON.stringify({ status: 'ok' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
