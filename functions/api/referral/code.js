export async function onRequest(context) {
  const db = context.env.DB;
  const url = new URL(context.request.url);
  const email = url.searchParams.get('email');

  if (!email) {
    return new Response(JSON.stringify({ error: 'Email required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  if (context.request.method === 'POST') {
    const body = await context.request.json();
    const { name } = body;
    try {
      const existing = await db.prepare('SELECT ref_code FROM subscribers WHERE email = ?').bind(email).first();
      if (existing && existing.ref_code) {
        return new Response(JSON.stringify({ ok: true, code: existing.ref_code }), { headers: { 'Content-Type': 'application/json' } });
      }
      const code = generateCode();
      if (existing) {
        await db.prepare('UPDATE subscribers SET ref_code = ? WHERE email = ?').bind(code, email).run();
      } else {
        await db.prepare('INSERT OR IGNORE INTO subscribers (email, name, ref_code, source) VALUES (?, ?, ?, ?)').bind(email, name || '', code, 'referral').run();
      }
      await db.prepare('INSERT OR IGNORE INTO referral_codes (code, owner_email, owner_name) VALUES (?, ?, ?)').bind(code, email, name || '').run();
      return new Response(JSON.stringify({ ok: true, code }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  try {
    const existing = await db.prepare('SELECT ref_code FROM subscribers WHERE email = ?').bind(email).first();
    if (existing && existing.ref_code) {
      return new Response(JSON.stringify({ ok: true, code: existing.ref_code }), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ ok: false, code: null }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    if (i > 0 && i % 4 === 0) code += '-';
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}