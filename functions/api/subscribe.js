// Geo → edition mapping
function detectEdition(country) {
  const map = {
    GH: 'GH', NG: 'GH', CI: 'GH', TG: 'GH', BJ: 'GH', SN: 'GH',
    GB: 'UK', IE: 'UK',
    US: 'NA', CA: 'NA',
  };
  return map[country] || 'ROW';
}

function genRefCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'GA-';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const REWARD_TIERS = [
  { min: 3,  tier: 'footer', label: 'Footer Banner Ad (1 issue)', value: 'GH¢2,000' },
  { min: 10, tier: 'leaderboard', label: 'Leaderboard Banner Ad (1 issue)', value: 'GH¢2,500' },
  { min: 50, tier: 'premium', label: 'Premium Package (1 month)', value: 'GH¢10,000' },
];

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
    const ct = request.headers.get('Content-Type') || '';
    let name = '', email = '', source = 'newsletter', ref = '';
    if (ct.includes('application/json')) {
      const body = await request.json();
      name = body.name || '';
      email = body.email || '';
      source = body.source || 'newsletter';
      ref = body.ref || '';
    } else {
      const fd = await request.formData();
      name = fd.get('name') || '';
      email = fd.get('email') || '';
      source = fd.get('source') || 'newsletter';
      ref = fd.get('ref') || '';
    }
    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Valid email required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    const cf = request.cf || {};
    const country = cf.country || '';
    const edition = detectEdition(country);
    let refCode = '';

    if (!env.DB) {
      return new Response(JSON.stringify({ error: 'D1 not bound' }), {
        status: 501, headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if existing subscriber
    const existing = await env.DB.prepare(
      'SELECT id, ref_code FROM subscribers WHERE email = ?'
    ).bind(email).first();

    if (existing) {
      refCode = existing.ref_code || '';
      return new Response(JSON.stringify({
        status: 'ok', existing: true,
        ref_code: refCode,
        edition: edition,
        message: 'You are already subscribed!'
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // Generate unique ref code
    refCode = genRefCode();

    // Insert subscriber
    await env.DB.prepare(
      'INSERT INTO subscribers (name, email, source, ref_code, edition, metadata) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(name, email, source, refCode, edition, JSON.stringify({ country })).run();

    // Handle referral if ref provided
    let referralCount = 0;
    if (ref && ref.startsWith('GA-')) {
      const referrer = await env.DB.prepare(
        'SELECT id FROM subscribers WHERE ref_code = ?'
      ).bind(ref).first();
      if (referrer) {
        await env.DB.prepare(
          'INSERT OR IGNORE INTO referrals (referrer_code, referred_name, referred_email, referred_country) VALUES (?, ?, ?, ?)'
        ).bind(ref, name, email, country).run();

        // Count referrals for reward eligibility
        const countRow = await env.DB.prepare(
          'SELECT COUNT(*) AS cnt FROM referrals WHERE referrer_code = ? AND reward_claimed = 0'
        ).bind(ref).first();
        referralCount = countRow ? countRow.cnt : 0;
      }
    }

    // Determine earned rewards
    let earnedRewards = [];
    if (referralCount > 0) {
      for (const tier of REWARD_TIERS) {
        if (referralCount >= tier.min) {
          const alreadyClaimed = await env.DB.prepare(
            'SELECT COUNT(*) AS cnt FROM referrals WHERE referrer_code = ? AND reward_tier = ? AND reward_claimed = 1'
          ).bind(ref, tier.tier).first();
          if (!alreadyClaimed || alreadyClaimed.cnt === 0) {
            earnedRewards.push(tier);
          }
        }
      }
    }

    // Brevo integration: add contact + send welcome
    let brevoId = '';
    if (env.BREVO_API_KEY) {
      try {
        const brevoContact = await fetch('https://api.brevo.com/v3/contacts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': env.BREVO_API_KEY
          },
          body: JSON.stringify({
            email,
            attributes: {
              NOME: name || '',
              SOURCE: source,
              REF_CODE: refCode,
              EDITION: edition,
              COUNTRY: country
            },
            listIds: [2], // Brevo list ID (default 2 = "The Studio Weekly")
            updateEnabled: true
          })
        });
        if (brevoContact.ok) {
          const bcData = await brevoContact.json();
          brevoId = String(bcData.id || '');
          if (brevoId) {
            await env.DB.prepare(
              'UPDATE subscribers SET brevo_id = ? WHERE email = ?'
            ).bind(brevoId, email).run();
          }
        }
      } catch (_e) {}

      // Send welcome email via Brevo SMTP
      try {
        const welcomeHtml = `<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#FAFAFA;padding:40px 20px">
          <table align="center" width="560" style="background:#fff;border-radius:8px;padding:40px">
            <tr><td style="text-align:center;padding-bottom:20px;border-bottom:1px solid #E2E6ED">
              <span style="font-family:'Barlow Condensed',sans-serif;font-size:11px;letter-spacing:.45em;color:#C9A84C;text-transform:uppercase">GideonAbochie Studio</span>
            </td></tr>
            <tr><td style="padding:32px 0 24px">
              <h1 style="font-family:'Barlow Condensed',sans-serif;font-size:32px;font-weight:700;color:#0A1628;margin:0 0 8px">Welcome to <span style="color:#C9A84C">The Studio Weekly</span></h1>
              <p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 16px">${name ? 'Hi ' + name + ',' : 'Hello,'}</p>
              <p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 16px">You are now part of a growing community of creators, thinkers, and changemakers who believe that education — and the world — can be rebuilt better.</p>
              <p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 24px">Every week, you will receive essays on creativity, love, wisdom, and the future of learning — plus curated news from Ghana and the diaspora.</p>
              <div style="background:#0A1628;border-radius:8px;padding:24px;text-align:center;margin-bottom:24px">
                <p style="font-family:'Barlow Condensed',sans-serif;font-size:14px;color:#C9A84C;margin:0 0 8px;text-transform:uppercase;letter-spacing:.15em">Your Referral Link</p>
                <p style="font-family:'Courier Prime',monospace;font-size:15px;color:#fff;margin:0;word-break:break-all">https://gideonabochie.org/newsletter/?ref=${refCode}</p>
              </div>
              <p style="font-family:Georgia,serif;font-size:13px;color:#94A3B8;line-height:1.6;margin:0">Share your referral link to earn free ad space. Refer 3 friends → Footer Banner ad. Refer 10 → Leaderboard ad. Refer 50 → Premium Package. Full details in your dashboard.</p>
            </td></tr>
            <tr><td style="text-align:center;padding-top:20px;border-top:1px solid #E2E6ED">
              <p style="font-family:'Courier Prime',monospace;font-size:10px;color:#94A3B8;margin:0">GideonAbochie Studio &mdash; Accra, Ghana</p>
            </td></tr>
          </table></body></html>`;

        await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': env.BREVO_API_KEY
          },
          body: JSON.stringify({
            sender: { name: 'Gideon Abochie', email: 'newsletter@gideonabochie.org' },
            to: [{ email, name: name || '' }],
            subject: 'Welcome to The Studio Weekly!',
            htmlContent: welcomeHtml
          })
        });
      } catch (_e) {}
    }

    return new Response(JSON.stringify({
      status: 'ok',
      existing: false,
      ref_code: refCode,
      edition: edition,
      referral_count: referralCount,
      earned_rewards: earnedRewards,
      message: 'Welcome to The Studio Weekly!'
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
