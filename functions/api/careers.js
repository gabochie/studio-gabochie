import { checkRateLimit } from './_rate-limit.js';
import { verifyTurnstile, turnstileToken } from './_turnstile.js';

var CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };

// Keep in sync with assets/js/careers-roles.json.
var ROLE_TITLES = {
  'ops-revenue': 'Operations & Revenue Coordinator',
  'curriculum-editor': 'Curriculum & Content Editor',
  'growth-partnerships': 'Growth & Partnerships',
  'learner-support': 'Learner Support & Consultation Coordinator',
  'web-ops': 'Web & Platform Engineer',
  'design': 'Brand & Learning Designer'
};

function clean(value, max) {
  var text = String(value == null ? '' : value).trim();
  return text ? text.slice(0, max || 200) : '';
}

// Only allow ordinary web URLs. A CV or portfolio field must never become a
// javascript: link in the admin review queue.
function safeUrl(value) {
  var text = clean(value, 500);
  if (!text) return '';
  try {
    var url = new URL(text);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.toString();
  } catch (_e) {
    return '';
  }
}

function hours(value) {
  var n = parseInt(String(value == null ? '' : value), 10);
  if (!isFinite(n) || n < 1 || n > 80) return 0;
  return n;
}

export async function onRequest(context) {
  var { request, env } = context;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  if (!env.DB) return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: { 'Content-Type': 'application/json', ...CORS } });

  // GET — not needed publicly
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...CORS } });

  var ip = request.headers.get('CF-Connecting-IP') || '';
  if (!await checkRateLimit(env.DB, ip, 'career', 3, 300)) {
    return new Response(JSON.stringify({ error: 'Too many requests. Try again later.' }), { status: 429, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  try {
    var body = await request.json();
    if (!await verifyTurnstile(env, request, turnstileToken(body))) {
      return new Response(JSON.stringify({ error: 'CAPTCHA verification failed. Please try again.' }), { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    var name = clean(body.name, 120);
    var email = clean(body.email, 200);
    if (!name || !email) {
      return new Response(JSON.stringify({ error: 'name and email required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    var roleId = clean(body.role_id, 60);
    if (!ROLE_TITLES[roleId]) roleId = 'general';
    var jobTitle = clean(body.job_title, 160) || ROLE_TITLES[roleId] || 'General application';
    var phone = clean(body.phone, 60);
    var country = clean(body.country, 100);
    var timezone = clean(body.timezone, 80);
    var availability = hours(body.availability_hours);
    var payExpectation = clean(body.pay_expectation, 160);
    var cvUrl = safeUrl(body.cv_url);
    var portfolioUrl = safeUrl(body.portfolio_url);
    var coverLetter = clean(body.cover_letter, 4000);

    var values = [
      jobTitle, roleId, name, email, phone, country, timezone,
      availability, payExpectation, cvUrl, portfolioUrl, coverLetter, 'careers-remote'
    ];

    // Newer databases have the structured columns. If db:setup has not run yet,
    // fall back to the original columns and keep the extra detail in the note
    // rather than dropping an application.
    try {
      await env.DB.prepare(
        "INSERT INTO career_applications (job_title, role_id, name, email, phone, country, timezone, availability_hours, pay_expectation, cv_url, portfolio_url, cover_letter, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind.apply(null, values).run();
    } catch (err) {
      if (!/no such column/i.test(String(err && err.message))) throw err;
      var fallback = coverLetter;
      var extras = [
        roleId !== 'general' ? 'Role: ' + roleId : '',
        country ? 'Country: ' + country : '',
        timezone ? 'Timezone: ' + timezone : '',
        availability ? 'Availability: ' + availability + 'h/week' : '',
        payExpectation ? 'Rate: ' + payExpectation : '',
        portfolioUrl ? 'Portfolio: ' + portfolioUrl : ''
      ].filter(Boolean).join('\n');
      if (extras) fallback = (fallback ? fallback + '\n\n' : '') + extras;
      await env.DB.prepare(
        "INSERT INTO career_applications (job_title, name, email, phone, cv_url, cover_letter) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(jobTitle, name, email, phone, cvUrl, fallback).run();
    }

    return new Response(JSON.stringify({ status: 'ok', message: 'Application received. We will review and get back to you within 5–7 business days.' }), { status: 201, headers: { 'Content-Type': 'application/json', ...CORS } });

  } catch (_err) {
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
  }
}
