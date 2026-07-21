import { checkRateLimit } from '../_rate-limit.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }
  const db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), { status: 501, headers: { 'Content-Type': 'application/json' } });
  }
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
  const allowed = await checkRateLimit(db, ip, 'nationbuilding_register', 10, 60);
  if (!allowed) {
    return new Response(JSON.stringify({ status: 'error', message: 'Too many requests' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    const body = await request.json();
    const { name, email, phone, region } = body;
    if (!name || !email) {
      return new Response(JSON.stringify({ status: 'error', message: 'Missing required fields: name, email' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    if (!email.includes('@')) {
      return new Response(JSON.stringify({ status: 'error', message: 'Invalid email' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const existing = await db.prepare('SELECT id FROM nationbuilding_registrations WHERE email = ?').bind(email).first();
    if (existing) {
      return new Response(JSON.stringify({ status: 'error', message: 'You are already registered for the Nationbuilding program' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    }
    await db.prepare(
      `INSERT INTO nationbuilding_registrations (name, email, phone, region) VALUES (?, ?, ?, ?)`
    ).bind(name, email, phone || '', region || '').run();
    if (env.BREVO_API_KEY && email) {
      try {
        const emailHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#F4F6FA;font-family:Georgia,serif">' +
          '<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">' +
          '<table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06)">' +
          '<tr><td style="background:#0A1628;padding:32px;text-align:center">' +
          '<h1 style="font-family:Georgia,serif;color:#C9A84C;font-size:24px;margin:0;letter-spacing:-.02em">Studio by Gabochie</h1>' +
          '<p style="color:#6B7F9A;font-size:12px;margin:8px 0 0">Nationbuilding Program Registration</p></td></tr>' +
          '<tr><td style="padding:32px">' +
          '<p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 20px">Dear ' + name.replace(/</g, '&lt;') + ',</p>' +
          '<p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 24px">Thank you for registering your interest in the <strong style="color:#C9A84C">Ghana Nationbuilding Program</strong>.</p>' +
          '<table width="100%" cellpadding="8" cellspacing="0" style="background:#F8FAFC;border-radius:8px;margin-bottom:24px">' +
          '<tr><td style="color:#64748B;font-size:12px;padding:8px 16px">Name</td><td style="color:#1E293B;font-size:13px;font-weight:600;text-align:right;padding:8px 16px">' + name.replace(/</g, '&lt;') + '</td></tr>' +
          '<tr><td style="color:#64748B;font-size:12px;padding:8px 16px;border-top:1px solid #E2E8F0">Email</td><td style="color:#1E293B;font-size:13px;text-align:right;padding:8px 16px;border-top:1px solid #E2E8F0">' + email.replace(/</g, '&lt;') + '</td></tr>' +
          (phone ? '<tr><td style="color:#64748B;font-size:12px;padding:8px 16px;border-top:1px solid #E2E8F0">Phone</td><td style="color:#1E293B;font-size:13px;text-align:right;padding:8px 16px;border-top:1px solid #E2E8F0">' + phone.replace(/</g, '&lt;') + '</td></tr>' : '') +
          (region ? '<tr><td style="color:#64748B;font-size:12px;padding:8px 16px;border-top:1px solid #E2E8F0">Region</td><td style="color:#1E293B;font-size:13px;text-align:right;padding:8px 16px;border-top:1px solid #E2E8F0">' + region.replace(/</g, '&lt;') + '</td></tr>' : '') +
          '</table>' +
          '<p style="color:#64748B;font-size:13px;line-height:1.6;margin:0 0 20px">We will keep you informed about program updates, workshops, and civic engagement opportunities. Together we are building a better Ghana.</p>' +
          '<p style="color:#64748B;font-size:13px;line-height:1.6;margin:0 0 20px">"An empowered youth contributing positively to national development." — Ghana National Youth Policy</p>' +
          '<p style="color:#94A3B8;font-size:11px;line-height:1.5;margin:0">Studio by Gabochie &mdash; Accra, Ghana</p>' +
          '</td></tr></table></td></tr></table></body></html>';
        await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
          body: JSON.stringify({
            sender: { name: 'Studio by Gabochie', email: 'newsletter@gabochie.com' },
            to: [{ email: email, name: name }],
            subject: 'Welcome to the Nationbuilding Program — Studio by Gabochie',
            htmlContent: emailHtml
          })
        });
      } catch (_e) {}
    }
    return new Response(JSON.stringify({ status: 'ok', message: 'Registered successfully' }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
