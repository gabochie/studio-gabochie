import { genToken } from '../auth/_hash.js';

export async function onRequest(context) {
  const { request, env } = context;
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
  const db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
  try {
    const { name, email, phone, skill_level } = await request.json();
    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Valid email required' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    const sanitize = s => (s || '').replace(/<[^>]*>/g, '').trim();
    const safeName = sanitize(name) || email.split('@')[0];
    const safeEmail = sanitize(email).toLowerCase();
    const safePhone = sanitize(phone);
    const safeLevel = sanitize(skill_level) || 'beginner';

    // Upsert user
    let isNewUser = false;
    let user = await db.prepare('SELECT id, name FROM users WHERE email = ?').bind(safeEmail).first();
    if (!user) {
      const r = await db.prepare('INSERT INTO users (name, email, phone) VALUES (?, ?, ?)').bind(safeName, safeEmail, safePhone).run();
      user = { id: r.meta.last_row_id, name: safeName };
      isNewUser = true;
    }

    // Create session token
    const token = genToken();
    await db.prepare("INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, datetime('now', '+30 days'))").bind(user.id, token).run();

    // Add to waitlist (ignore if already there)
    try {
      await db.prepare('INSERT OR IGNORE INTO guitar_waitlist (user_id, name, email, phone, skill_level) VALUES (?, ?, ?, ?, ?)').bind(user.id, safeName, safeEmail, safePhone, safeLevel).run();
    } catch (_) {}

    // Create guitar_user_stats if not exists
    try {
      await db.prepare('INSERT OR IGNORE INTO guitar_user_stats (user_id) VALUES (?)').bind(user.id).run();
    } catch (_) {}

    // Brevo: create/update contact (always)
    let brevoId = '';
    if (env.BREVO_API_KEY) {
      try {
        const brevoResp = await fetch('https://api.brevo.com/v3/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
          body: JSON.stringify({
            email: safeEmail,
            attributes: { NOME: safeName, SOURCE: 'guitar_course', SKILL_LEVEL: safeLevel },
            listIds: [2],
            updateEnabled: true
          })
        });
        if (brevoResp.ok) {
          const bcData = await brevoResp.json();
          brevoId = String(bcData.id || '');
          if (brevoId) {
            try { await db.prepare('UPDATE guitar_waitlist SET brevo_id = ? WHERE email = ?').bind(brevoId, safeEmail).run(); } catch (_) {}
          }
        }
      } catch (_) {}

      // Send welcome email only to new users
      if (isNewUser) {
        let price = '250', currency = 'GH₵';
        try {
          const pRow = await db.prepare("SELECT value FROM settings WHERE key = 'guitar_price'").first();
          if (pRow) price = pRow.value;
          const cRow = await db.prepare("SELECT value FROM settings WHERE key = 'guitar_currency_symbol'").first();
          if (cRow) currency = cRow.value;
        } catch (_) {}

        try {
          await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
            body: JSON.stringify({
              sender: { name: 'Gideon Abochie', email: 'newsletter@gabochie.com' },
              to: [{ email: safeEmail, name: safeName }],
              subject: 'Welcome to Gideon Guitar Method!',
              htmlContent: `<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#FAFAFA;padding:40px 20px"><table align="center" width="560" style="background:#fff;border-radius:8px;padding:40px"><tr><td style="text-align:center;padding-bottom:20px;border-bottom:1px solid #E2E6ED"><span style="font-family:'Barlow Condensed',sans-serif;font-size:11px;letter-spacing:.45em;color:#C9A84C;text-transform:uppercase">Gideon Guitar Method</span></td></tr><tr><td style="padding:32px 0 24px"><h1 style="font-family:'Barlow Condensed',sans-serif;font-size:32px;font-weight:700;color:#0A1628;margin:0 0 8px">Welcome to the <span style="color:#C9A84C">Guitar Course</span></h1><p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 16px">Hi ${safeName},</p><p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 16px">You have joined the Gideon Guitar Method! Start with Modules 1-3 for free, then unlock the full course for ${currency} ${price}.</p><div style="text-align:center;margin:24px 0"><a href="https://studio.gabochie.com/guitar/learn/" style="display:inline-block;background:#C9A84C;color:#0A1628;text-decoration:none;font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:14px 36px;border-radius:6px">Start Learning</a></div><p style="font-family:Georgia,serif;font-size:13px;color:#94A3B8;line-height:1.6;margin:0">Warmly,<br>Gideon Abochie</p></td></tr><tr><td style="text-align:center;padding-top:20px;border-top:1px solid #E2E6ED"><p style="font-family:'Courier Prime',monospace;font-size:10px;color:#94A3B8;margin:0">Studio by Gabochie &mdash; Accra, Ghana</p></td></tr></table></body></html>`
            })
          });
        } catch (_) {}
      }
    }

    return new Response(JSON.stringify({
      status: 'ok',
      token,
      user: { id: user.id, name: safeName, email: safeEmail }
    }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('register error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
}
