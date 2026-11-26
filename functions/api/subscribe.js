var ASSESSMENT_SOURCE = 'money-ghana-assessment';
var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
var ASSESSMENT_KEYS = ['profile', 'setup', 'capital', 'top_path'];

function isAssessmentSource(source) {
  return source === ASSESSMENT_SOURCE;
}

function short(value, max) {
  return String(value == null ? '' : value).slice(0, max);
}

function parseMetadata(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return Object.assign({}, raw);
  try {
    var parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_e) {
    return {};
  }
}

// Whitelist inbound values, keep everything already stored on the subscriber,
// and expose assessment answers under both canonical and shorthand keys.
function sanitizeMetadata(input, existing) {
  var meta = Object.assign({}, existing || {});
  if (input.country) meta.country = short(input.country, 2);
  UTM_KEYS.forEach(function (key) {
    var value = input[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      meta[key] = short(value, key === 'utm_campaign' || key === 'utm_content' || key === 'utm_term' ? 120 : 80);
    }
  });
  ASSESSMENT_KEYS.forEach(function (key) {
    var value = input['assessment_' + key] !== undefined && input['assessment_' + key] !== ''
      ? input['assessment_' + key] : input[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      var clean = short(value, 120);
      meta['assessment_' + key] = clean;
      meta[key] = clean;
    }
  });
  if (input.assessment_source) meta.assessment_source = 1;
  if (input.assessment_welcome_sent) meta.assessment_welcome_sent = 1;
  if (input.assessment_followup_queued) meta.assessment_followup_queued = 1;
  return meta;
}

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

import { confirmSubscription, assessmentWelcome, assessmentFollowup, queueEmail, daysFromNow } from './email/_send.js';
import { checkRateLimit } from './_rate-limit.js';
import { verifyTurnstile, turnstileToken } from './_turnstile.js';

async function sendAssessmentGuide(env, email, name, refCode) {
  if (!env.BREVO_API_KEY) return;
  try {
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
      body: JSON.stringify({
        sender: { name: 'Gideon Abochie', email: 'newsletter@gabochie.com' },
        to: [{ email: email, name: name || '' }],
        subject: 'Your Ghana income guide is ready',
        htmlContent: assessmentWelcome(name, refCode)
      })
    });
  } catch (_e) {}
}

async function queueAssessmentLadder(env, email, name) {
  if (!env.BREVO_API_KEY) return;
  try {
    await queueEmail(env, email, name, 'From your income guide to one clear plan',
      assessmentFollowup(name), 'welcome_followup', daysFromNow(3));
  } catch (_e) {}
}

async function updateExistingSubscriber(db, email, values) {
  await db.prepare(
    "UPDATE subscribers SET source = ?, metadata = ?, phone = ?, whatsapp_opt_in = ?, lotl_daily = ? WHERE email = ?"
  ).bind(values.source, JSON.stringify(values.metadata), values.phone || '',
    values.whatsapp_opt_in ? 1 : 0, values.lotl_daily ? 1 : 0, email).run();
}

export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), { status: 405, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  }
  try {
    var ct = request.headers.get('Content-Type') || '';
    var name = '', email = '', source = 'newsletter', ref = '', phone = '';
    var utmSource = '', utmMedium = '', utmCampaign = '', utmContent = '', utmTerm = '';
    var assessment = {};
    var waOptIn = false;
    var lotlDaily = false;
    var turnstile = '';
    if (ct.includes('application/json')) {
      var body = await request.json();
      name = body.name || '';
      email = body.email || '';
      source = body.source || 'newsletter';
      ref = body.ref || '';
      phone = body.phone || '';
      waOptIn = body.whatsapp_opt_in === true || body.whatsapp_opt_in === 1 || body.whatsapp_opt_in === '1';
      lotlDaily = body.lotl_daily === true || body.lotl_daily === 1 || body.lotl_daily === '1';
      utmSource = body.utm_source || '';
      utmMedium = body.utm_medium || '';
      utmCampaign = body.utm_campaign || '';
      utmContent = body.utm_content || '';
      utmTerm = body.utm_term || '';
      ASSESSMENT_KEYS.forEach(function (key) {
        assessment[key] = body['assessment_' + key] || body[key] || '';
      });
      turnstile = turnstileToken(body);
    } else {
      var fd = await request.formData();
      name = fd.get('name') || '';
      email = fd.get('email') || '';
      source = fd.get('source') || 'newsletter';
      ref = fd.get('ref') || '';
      phone = fd.get('phone') || '';
      waOptIn = fd.get('whatsapp_opt_in') === '1' || fd.get('whatsapp_opt_in') === 'on';
      lotlDaily = fd.get('lotl_daily') === '1' || fd.get('lotl_daily') === 'on';
      utmSource = fd.get('utm_source') || '';
      utmMedium = fd.get('utm_medium') || '';
      utmCampaign = fd.get('utm_campaign') || '';
      utmContent = fd.get('utm_content') || '';
      utmTerm = fd.get('utm_term') || '';
      ASSESSMENT_KEYS.forEach(function (key) {
        assessment[key] = fd.get('assessment_' + key) || fd.get(key) || '';
      });
      turnstile = turnstileToken(fd, 'form');
    }
    if (!await verifyTurnstile(env, request, turnstile)) {
      return new Response(JSON.stringify({ status: 'error', message: 'CAPTCHA verification failed. Please try again.' }), {
        status: 403, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    var metaInput = {
      country: '',
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_content: utmContent,
      utm_term: utmTerm,
      assessment_source: isAssessmentSource(source) ? 1 : 0
    };
    ASSESSMENT_KEYS.forEach(function (key) { metaInput['assessment_' + key] = assessment[key]; });
    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Valid email required' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }
    var cf = request.cf || {};
    var country = cf.country || '';
    var edition = detectEdition(country);
    var confirmUrl = '';
    metaInput.country = country;
    var meta = sanitizeMetadata(metaInput, {});

  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  }

  var ip = request.headers.get('CF-Connecting-IP') || '';
  if (!await checkRateLimit(env.DB, ip, 'subscribe', 5, 60)) {
    return new Response(JSON.stringify({ status: 'error', message: 'Too many subscriptions. Try again later.' }), {
      status: 429, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  }

  // Check if existing subscriber
    var existing = await env.DB.prepare(
      'SELECT id, name, ref_code, confirmed, confirm_token, source, metadata, phone, whatsapp_opt_in, lotl_daily FROM subscribers WHERE email = ?'
    ).bind(email).first();

    if (existing) {
      var existingMeta = parseMetadata(existing.metadata);
      var assessmentRequest = isAssessmentSource(source);
      var assessmentLead = assessmentRequest || isAssessmentSource(existing.source) || !!existingMeta.assessment_source;
      if (assessmentLead) metaInput.assessment_source = 1;
      var mergedMeta = sanitizeMetadata(metaInput, existingMeta);
      var subscriberValues = {
        source: assessmentRequest ? ASSESSMENT_SOURCE : (existing.source || source),
        metadata: mergedMeta,
        phone: phone || existing.phone || '',
        whatsapp_opt_in: waOptIn || existing.whatsapp_opt_in || 0,
        lotl_daily: lotlDaily || existing.lotl_daily || 0
      };

      if (existing.confirmed === 1) {
        // A confirmed assessment lead still needs their guide and day-3 ladder.
        // The metadata flags make repeat form submissions idempotent.
        var sendGuideNow = assessmentLead && !!env.BREVO_API_KEY && !existingMeta.assessment_welcome_sent;
        if (sendGuideNow) {
          mergedMeta.assessment_welcome_sent = 1;
          mergedMeta.assessment_followup_queued = 1;
        }
        await updateExistingSubscriber(env.DB, email, subscriberValues);
        if (sendGuideNow) {
          await sendAssessmentGuide(env, email, name || existing.name, existing.ref_code || '');
          await queueAssessmentLadder(env, email, name || existing.name);
        }
        return new Response(JSON.stringify({
          status: 'ok', existing: true, confirmed: true,
          ref_code: existing.ref_code || '',
          edition: edition,
          message: sendGuideNow ? 'Check your inbox — your Ghana income guide is on its way.' : 'You are already subscribed!'
        }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      }
      if (existing.confirm_token) {
        // Pending subscriber — keep source/UTMs/answers so confirmation can
        // deliver the assessment guide and queue the consultation follow-up.
        await updateExistingSubscriber(env.DB, email, subscriberValues);
        confirmUrl = 'https://studio.gabochie.com/api/subscribe/confirm?token=' + existing.confirm_token;
        var guideResend = assessmentLead;
        if (env.BREVO_API_KEY) {
          try {
            await fetch('https://api.brevo.com/v3/smtp/email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
              body: JSON.stringify({
                sender: { name: 'Gideon Abochie', email: 'newsletter@gabochie.com' },
                to: [{ email: email, name: name || existing.name || '' }],
                subject: guideResend ? 'Confirm your email — get your Ghana income guide' : 'Please confirm your subscription',
                htmlContent: confirmSubscription(name || existing.name, confirmUrl, guideResend)
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
      var legacyGuide = assessmentLead && !!env.BREVO_API_KEY && !existingMeta.assessment_welcome_sent;
      if (legacyGuide) {
        mergedMeta.assessment_welcome_sent = 1;
        mergedMeta.assessment_followup_queued = 1;
      }
      await updateExistingSubscriber(env.DB, email, subscriberValues);
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
        if (legacyGuide) {
          await sendAssessmentGuide(env, email, name || existing.name, legacyRef);
          await queueAssessmentLadder(env, email, name || existing.name);
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
      "INSERT INTO subscribers (name, email, source, ref_code, edition, metadata, confirmed, confirm_token, phone, whatsapp_opt_in, lotl_daily) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)"
    ).bind(name, email, source, refCode, edition, JSON.stringify(meta), confirmToken, phone, waOptIn ? 1 : 0, lotlDaily ? 1 : 0).run();

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
    confirmUrl = 'https://studio.gabochie.com/api/subscribe/confirm?token=' + confirmToken;
    var guideSignup = isAssessmentSource(source);
    if (env.BREVO_API_KEY) {
      try {
        await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
          body: JSON.stringify({
            sender: { name: 'Gideon Abochie', email: 'newsletter@gabochie.com' },
            to: [{ email: email, name: name || '' }],
            subject: guideSignup ? 'Confirm your email — get your Ghana income guide' : 'Please confirm your subscription',
            htmlContent: confirmSubscription(name, confirmUrl, guideSignup)
          })
        });
      } catch (_) {}
    }

    return new Response(JSON.stringify({
      status: 'ok', existing: false, confirmed: false,
      message: 'Check your email to confirm your subscription.'
    }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  }
}
