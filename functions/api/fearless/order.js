import { queueEmail, daysFromNow } from '../email/_send.js';
import { checkRateLimit } from '../_rate-limit.js';

var READER_URL = 'https://studio.gabochie.com/books/fearless-steps/read/';
var CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function receiptHtml(name, ref, city, phone) {
  var first = (name || 'friend').split(' ')[0];
  return '<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#FAFAFA;color:#222;padding:24px">'
    + '<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e4e8ee;border-top:5px solid #C9A84C;border-radius:12px;padding:28px">'
    + '<p style="font-size:12px;letter-spacing:.2em;color:#C9A84C;font-weight:bold">THE VICTORIOUS LIFE SERIES</p>'
    + '<h2 style="margin:6px 0">Order received, ' + esc(first) + '.</h2>'
    + '<p>Your reference: <strong style="font-size:20px;letter-spacing:.1em">' + esc(ref) + '</strong></p>'
    + '<p>' + esc(name) + ' &middot; ' + esc(city) + ' &middot; GHS 49 on delivery &middot; confirmation goes to ' + esc(phone) + '</p>'
    + '<ol><li>We confirm on WhatsApp within 24 hours with your delivery time.</li>'
    + '<li>Pay GHS 49 on delivery (cash or MoMo) — quote your reference.</li>'
    + '<li>Your copy unlocks the full online reader &amp; audio code.</li></ol>'
    + '<p><a href="' + READER_URL + '" style="display:inline-block;background:#C9A84C;color:#241c00;font-weight:bold;padding:12px 26px;border-radius:999px;text-decoration:none">Read the free sample while you wait</a></p>'
    + '<p style="font-size:12px;color:#888">Screenshot this email — your reference proves your pre-order price. Questions? WhatsApp +233 243 262 019.</p>'
    + '</div></body></html>';
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function onRequest(context) {
  var req = context.request, env = context.env;
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), { status: 405, headers: Object.assign({ 'Content-Type': 'application/json' }, CORS) });
  }
  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: Object.assign({ 'Content-Type': 'application/json' }, CORS) });
  }
  try {
    var body = await req.json();
    var ref = String(body.ref || '').toUpperCase().slice(0, 12);
    var name = String(body.name || '').slice(0, 80);
    var phone = String(body.phone || '').replace(/[^0-9+]/g, '').slice(0, 20);
    var city = String(body.city || '').slice(0, 60);
    var email = String(body.email || '').slice(0, 120);
    var variant = String(body.variant || 'b').slice(0, 4);
    var source = String(body.source || 'sales').slice(0, 20);
    if (!/^FS-[A-Z0-9]{6}$/.test(ref)) {
      return new Response(JSON.stringify({ error: 'Bad reference format' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, CORS) });
    }
    if (!name || phone.replace(/\D/g, '').length < 9) {
      return new Response(JSON.stringify({ error: 'Name + valid phone required' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, CORS) });
    }
    var ip = req.headers.get('CF-Connecting-IP') || '';
    if (!await checkRateLimit(env.DB, ip, 'fearless_order', 10, 60)) {
      return new Response(JSON.stringify({ status: 'error', message: 'Too many orders. Try again later.' }), { status: 429, headers: Object.assign({ 'Content-Type': 'application/json' }, CORS) });
    }
    await env.DB.prepare(
      'INSERT OR IGNORE INTO fearless_orders (ref, name, phone, city, email, variant, source) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(ref, name, phone, city, email, variant, source).run();

    var emailed = false;
    if (email && email.indexOf('@') > 0) {
      try {
        await queueEmail(env, email, name, 'Order received — 7 Fearless Steps (' + ref + ')',
          receiptHtml(name, ref, city, phone), 'fearless-receipt', daysFromNow(0));
        emailed = true;
      } catch (_) {}
    }
    return new Response(JSON.stringify({ status: 'ok', ref: ref, emailed: emailed }), {
      headers: Object.assign({ 'Content-Type': 'application/json' }, CORS)
    });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, CORS) });
  }
}
