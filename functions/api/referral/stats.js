export async function onRequest(context) {
  const db = context.env.DB;
  const url = new URL(context.request.url);
  const email = url.searchParams.get('email');
  const code = url.searchParams.get('code');

  try {
    if (code) {
      const count = await db.prepare('SELECT COUNT(*) as total FROM referrals WHERE referrer_code = ?').bind(code).first();
      const referrals = await db.prepare('SELECT referred_name, referred_email, referred_at FROM referrals WHERE referrer_code = ? ORDER BY referred_at DESC LIMIT 20').bind(code).all();
      const owner = await db.prepare('SELECT owner_name FROM referral_codes WHERE code = ?').bind(code).first();
      return new Response(JSON.stringify({ ok: true, code, count: count.total, referrals: referrals.results, owner: owner?.owner_name || '' }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (email) {
      const refCode = await db.prepare('SELECT ref_code FROM subscribers WHERE email = ?').bind(email).first();
      if (!refCode || !refCode.ref_code) {
        return new Response(JSON.stringify({ ok: false, count: 0, referrals: [], code: null }), { headers: { 'Content-Type': 'application/json' } });
      }
      const count = await db.prepare('SELECT COUNT(*) as total FROM referrals WHERE referrer_code = ?').bind(refCode.ref_code).first();
      const referrals = await db.prepare('SELECT referred_name, referred_email, referred_at FROM referrals WHERE referrer_code = ? ORDER BY referred_at DESC LIMIT 20').bind(refCode.ref_code).all();
      return new Response(JSON.stringify({ ok: true, code: refCode.ref_code, count: count.total, referrals: referrals.results }), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ error: 'Email or code required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}