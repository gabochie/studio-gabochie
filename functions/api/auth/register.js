function sanitize(s) { return (s || '').replace(/<[^>]*>/g, '').trim(); }

export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ status: 'error', message: 'Method not allowed' }), {
      status: 405, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  }
  var db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  }
  try {
    var body = await request.json();
    var name = sanitize(body.name);
    var email = (body.email || '').trim().toLowerCase();
    var phone = sanitize(body.phone);
    var accessCode = (body.access_code || '').trim();
    if (!name || !email || !accessCode) {
      return new Response(JSON.stringify({ status: 'error', message: 'Name, email, and access code are required' }), {
        status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    if (accessCode.length < 4) {
      return new Response(JSON.stringify({ status: 'error', message: 'Access code must be at least 4 characters' }), {
        status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    if (!email.includes('@') || email.length > 254) {
      return new Response(JSON.stringify({ status: 'error', message: 'Invalid email address' }), {
        status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    if (name.length > 100 || accessCode.length > 100 || phone.length > 50) {
      return new Response(JSON.stringify({ status: 'error', message: 'Input too long' }), {
        status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    var existing = await db.prepare('SELECT id FROM students WHERE email = ?').bind(email).first();
    if (existing) {
      return new Response(JSON.stringify({ status: 'error', message: 'An account with this email already exists' }), {
        status: 409, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    await db.prepare(
      'INSERT INTO students (name, email, phone, access_code) VALUES (?, ?, ?, ?)'
    ).bind(name, email, phone, accessCode).run();

    if (env.BREVO_API_KEY) {
      try {
        await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
          body: JSON.stringify({
            sender: { name: 'GideonAbochie Studio', email: 'newsletter@gideonabochie.org' },
            to: [{ email: email, name: name }],
            subject: 'Welcome to GideonAbochie Studio',
            htmlContent: '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F4F6FA;font-family:Georgia,serif"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px"><table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06)"><tr><td style="background:#0A1628;padding:32px;text-align:center"><h1 style="font-family:Georgia,serif;color:#C9A84C;font-size:24px;margin:0;letter-spacing:-.02em">GideonAbochie Studio</h1><p style="color:#6B7F9A;font-size:12px;margin:8px 0 0">Account Created</p></td></tr><tr><td style="padding:32px"><p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 16px">Dear ' + name + ',</p><p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 24px">Your account has been created. You can now explore the <a href="https://gideonabochie.org/school/" style="color:#C9A84C">school</a> and enroll in courses.</p><p style="color:#64748B;font-size:12px;line-height:1.5;margin:0">Your access code: <strong style="font-family:monospace;font-size:16px;color:#0A1628">' + accessCode + '</strong><br> Keep this private — you will need it to log in.</p></td></tr><tr><td style="padding:16px 32px;border-top:1px solid #E2E8F0"><p style="color:#94A3B8;font-size:10px;margin:0">GideonAbochie Studio &mdash; Accra, Ghana</p></td></tr></table></td></tr></table></body></html>'
          })
        });
      } catch (_e) {}
    }

    var enrollments = await db.prepare(
      `SELECT e.access_token, e.status, p.title AS program_title, p.slug AS program_slug
       FROM enrollments e JOIN programs p ON e.program_id = p.id
       WHERE e.student_email = ?
       ORDER BY e.enrolled_at DESC`
    ).bind(email).all();
    return new Response(JSON.stringify({
      status: 'ok',
      student: { name: name, email: email },
      enrollments: enrollments.results || []
    }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  }
}
