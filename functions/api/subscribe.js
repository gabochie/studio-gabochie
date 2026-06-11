function detectEdition(country) {
  var map = { GH: 'GH', NG: 'GH', CI: 'GH', TG: 'GH', BJ: 'GH', SN: 'GH', GB: 'UK', IE: 'UK', US: 'NA', CA: 'NA' };
  return map[country] || 'ROW';
}

function genRefCode() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var code = 'GA-';
  for (var i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function genToken() {
  var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  var t = '';
  for (var i = 0; i < 32; i++) t += chars[Math.floor(Math.random() * chars.length)];
  return t;
}

var REWARD_TIERS = [
  { min: 3, tier: 'footer', label: 'Footer Banner Ad (1 issue)', value: 'GH¢2,000' },
  { min: 10, tier: 'leaderboard', label: 'Leaderboard Banner Ad (1 issue)', value: 'GH¢2,500' },
  { min: 50, tier: 'premium', label: 'Premium Package (1 month)', value: 'GH¢10,000' },
];

import { confirmSubscription } from './email/_send.js';

export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), { status: 405, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  }
  try {
    var ct = request.headers.get('Content-Type') || '';
    var name = '', email = '', source = 'newsletter', ref = '';
    if (ct.includes('application/json')) {
      var body = await request.json();
      name = body.name || '';
      email = body.email || '';
      source = body.source || 'newsletter';
      ref = body.ref || '';
    } else {
      var fd = await request.formData();
      name = fd.get('name') || '';
      email = fd.get('email') || '';
      source = fd.get('source') || 'newsletter';
      ref = fd.get('ref') || '';
    }
    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Valid email required' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }
    var cf = request.cf || {};
    var country = cf.country || '';
    var edition = detectEdition(country);
    var confirmUrl = '';

    if (!env.DB) {
      return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    // Check if existing subscriber
    var existing = await env.DB.prepare(
      'SELECT id, ref_code, confirmed, confirm_token FROM subscribers WHERE email = ?'
    ).bind(email).first();

    if (existing) {
      if (existing.confirmed === 1) {
        // Already confirmed
        return new Response(JSON.stringify({
          status: 'ok', existing: true, confirmed: true,
          ref_code: existing.ref_code || '',
          edition: edition,
          message: 'You are already subscribed!'
        }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      }
      if (existing.confirm_token) {
        // New subscriber who hasn't confirmed — resend confirmation
        confirmUrl = 'https://gideonabochie.org/api/subscribe/confirm?token=' + existing.confirm_token;
        if (env.BREVO_API_KEY) {
          try {
            await fetch('https://api.brevo.com/v3/smtp/email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
              body: JSON.stringify({
                sender: { name: 'Gideon Abochie', email: 'newsletter@gideonabochie.org' },
                to: [{ email: email, name: name || existing.name || '' }],
                subject: 'Please confirm your subscription',
                htmlContent: confirmSubscription(name || existing.name, confirmUrl)
              })
            });
          } catch (_) {}
        }
        return new Response(JSON.stringify({
          status: 'ok', existing: true, confirmed: false,
          message: 'Confirmation email resent. Please check your inbox.'
        }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      }
      // Legacy subscriber (confirmed=0, no token) — auto-confirm
      var token = genToken();
      await env.DB.prepare(
        "UPDATE subscribers SET confirmed = 1, confirm_token = ? WHERE email = ?"
      ).bind(token, email).run();
      try {
        var legacySub = await env.DB.prepare('SELECT id, ref_code FROM subscribers WHERE email = ?').bind(email).first();
        var legacyRef = legacySub ? legacySub.ref_code || '' : '';
        if (env.BREVO_API_KEY) {
          try {
            var brevoResp = await fetch('https://api.brevo.com/v3/contacts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
              body: JSON.stringify({ email, attributes: { NOME: name || '', SOURCE: source, REF_CODE: legacyRef, EDITION: edition, COUNTRY: country }, listIds: [2], updateEnabled: true })
            });
            if (brevoResp.ok) {
              var bcData = await brevoResp.json();
              if (bcData.id) await env.DB.prepare('UPDATE subscribers SET brevo_id = ? WHERE email = ?').bind(String(bcData.id), email).run();
            }
          } catch (_) {}
        }
        return new Response(JSON.stringify({
          status: 'ok', existing: true, confirmed: true, ref_code: legacyRef, edition: edition,
          message: 'Welcome back! Your subscription is active.'
        }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      } catch (_) {}
    }

    // New subscriber — generate ref code + confirm token
    var refCode = genRefCode();
    var confirmToken = genToken();

    await env.DB.prepare(
      "INSERT INTO subscribers (name, email, source, ref_code, edition, metadata, confirmed, confirm_token) VALUES (?, ?, ?, ?, ?, ?, 0, ?)"
    ).bind(name, email, source, refCode, edition, JSON.stringify({ country }), confirmToken).run();

    // Handle referral if provided
    var referralCount = 0;
    var earnedRewards = [];
    if (ref && ref.startsWith('GA-')) {
      var referrer = await env.DB.prepare('SELECT id FROM subscribers WHERE ref_code = ?').bind(ref).first();
      if (referrer) {
        await env.DB.prepare('INSERT OR IGNORE INTO referrals (referrer_code, referred_name, referred_email, referred_country) VALUES (?, ?, ?, ?)').bind(ref, name, email, country).run();
        var countRow = await env.DB.prepare('SELECT COUNT(*) AS cnt FROM referrals WHERE referrer_code = ? AND reward_claimed = 0').bind(ref).first();
        referralCount = countRow ? countRow.cnt : 0;
        if (referralCount > 0) {
          for (var tier of REWARD_TIERS) {
            if (referralCount >= tier.min) {
              var alreadyClaimed = await env.DB.prepare('SELECT COUNT(*) AS cnt FROM referrals WHERE referrer_code = ? AND reward_tier = ? AND reward_claimed = 1').bind(ref, tier.tier).first();
              if (!alreadyClaimed || alreadyClaimed.cnt === 0) earnedRewards.push(tier);
            }
          }
        }
      }
    }

    // Send confirmation email
    confirmUrl = 'https://gideonabochie.org/api/subscribe/confirm?token=' + confirmToken;
    if (env.BREVO_API_KEY) {
      try {
        await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
          body: JSON.stringify({
            sender: { name: 'Gideon Abochie', email: 'newsletter@gideonabochie.org' },
            to: [{ email: email, name: name || '' }],
            subject: 'Please confirm your subscription',
            htmlContent: confirmSubscription(name, confirmUrl)
          })
        });
      } catch (_) {}
    }

    return new Response(JSON.stringify({
      status: 'ok', existing: false, confirmed: false,
      message: 'Check your email to confirm your subscription.'
    }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  }
}
