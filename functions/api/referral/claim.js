export async function onRequest(context) {
  const db = context.env.DB;
  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    const body = await context.request.json();
    const { code, email, name, country } = body;
    if (!code || !email) {
      return new Response(JSON.stringify({ error: 'Referral code and email required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const normCode = code.toUpperCase().trim();
    const valid = await db.prepare('SELECT * FROM referral_codes WHERE code = ?').bind(normCode).first();
    if (!valid) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid referral code' }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (valid.owner_email === email) {
      return new Response(JSON.stringify({ ok: false, error: 'You cannot use your own referral code' }), { headers: { 'Content-Type': 'application/json' } });
    }
    try {
      await db.prepare('INSERT INTO referrals (referrer_code, referred_name, referred_email, referred_country) VALUES (?, ?, ?, ?)')
        .bind(normCode, name || '', email, country || '').run();
    } catch (e) {
      if (e.message && e.message.includes('UNIQUE')) {
        return new Response(JSON.stringify({ ok: true, already_referred: true }), { headers: { 'Content-Type': 'application/json' } });
      }
      throw e;
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}