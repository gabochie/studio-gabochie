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
    var email = (body.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ status: 'error', message: 'Valid email required' }), {
        status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    var student = await db.prepare(
      'SELECT id, name, access_code FROM students WHERE email = ?'
    ).bind(email).first();
    if (!student) {
      return new Response(JSON.stringify({ status: 'error', message: 'No account found with this email' }), {
        status: 404, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    if (env.BREVO_API_KEY) {
      var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#F4F6FA;font-family:Georgia,serif">' +
        '<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">' +
        '<table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06)">' +
        '<tr><td style="background:#0A1628;padding:32px;text-align:center">' +
        '<h1 style="font-family:Georgia,serif;color:#C9A84C;font-size:24px;margin:0;letter-spacing:-.02em">GideonAbochie Studio</h1>' +
        '<p style="color:#6B7F9A;font-size:12px;margin:8px 0 0">Access Code</p></td></tr>' +
        '<tr><td style="padding:32px">' +
        '<p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 16px">Dear ' + (student.name || 'Student') + ',</p>' +
        '<p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 24px">Here is your access code for GideonAbochie Studio:</p>' +
        '<div style="background:#F8FAFC;border:2px dashed #C9A84C;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px">' +
        '<p style="font-family:\'Courier Prime\',monospace;font-size:28px;color:#0A1628;letter-spacing:4px;margin:0">' + student.access_code + '</p></div>' +
        '<p style="color:#64748B;font-size:13px;line-height:1.6;margin:0">Use this code to log in at <a href="https://gideonabochie.org/dashboard/" style="color:#C9A84C">gideonabochie.org/dashboard</a>. Keep it private.</p>' +
        '</td></tr>' +
        '<tr><td style="padding:16px 32px;border-top:1px solid #E2E8F0">' +
        '<p style="color:#94A3B8;font-size:10px;margin:0">GideonAbochie Studio &mdash; Accra, Ghana</p></td></tr>' +
        '</table></td></tr></table></body></html>';
      try {
        await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
          body: JSON.stringify({
            sender: { name: 'GideonAbochie Studio', email: 'newsletter@gideonabochie.org' },
            to: [{ email: email, name: student.name || '' }],
            subject: 'Your Access Code — GideonAbochie Studio',
            htmlContent: html
          })
        });
      } catch (_e) {}
    }
    return new Response(JSON.stringify({ status: 'ok', message: 'Access code sent to your email' }), {
      headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  }
}
