import { queueEmail, enrollmentFollowup, daysFromNow } from '../email/_send.js';

function genToken() {
  var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  var r = '';
  for (var i = 0; i < 24; i++) r += chars.charAt(Math.floor(Math.random() * chars.length));
  return 'ga_' + Date.now().toString(36) + '_' + r;
}

export async function onRequest(context) {
  var { request, env } = context;
  var db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }
  var url = new URL(request.url);

  if (request.method === 'GET') {
    var token = url.searchParams.get('token') || '';
    if (!token) {
      return new Response(JSON.stringify({ status: 'error', message: 'Missing token' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    try {
      var row = await db.prepare(
        'SELECT e.id, e.program_id, e.student_name, e.student_email, e.student_phone, e.status, e.payment_ref, e.payment_amount, e.enrolled_at, p.title AS program_title, p.slug AS program_slug, p.tagline, p.duration, p.price, p.price_label, p.sample_content, p.full_content FROM enrollments e JOIN programs p ON e.program_id = p.id WHERE e.access_token = ?'
      ).bind(token).first();
      if (!row) {
        return new Response(JSON.stringify({ status: 'error', message: 'Invalid token' }), {
          status: 404, headers: { 'Content-Type': 'application/json' }
        });
      }
      // Only return full_content if enrollment is active (paid or free program)
      var isPaidAccess = row.status === 'active';
      var response = {
        status: 'ok',
        enrollment: {
          id: row.id,
          program_id: row.program_id,
          student_name: row.student_name,
          student_email: row.student_email,
          student_phone: row.student_phone,
          status: row.status,
          payment_ref: row.payment_ref,
          payment_amount: row.payment_amount,
          enrolled_at: row.enrolled_at,
          program_title: row.program_title,
          program_slug: row.program_slug,
          tagline: row.tagline,
          duration: row.duration,
          price: row.price,
          price_label: row.price_label,
          sample_content: row.sample_content,
          full_content: isPaidAccess ? (row.full_content || '') : ''
        }
      };
      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ status: 'error', message: err.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    var body = await request.json();
    var programSlug = body.program_slug || '';
    var studentName = (body.name || '').trim();
    var studentEmail = (body.email || '').trim().toLowerCase();
    var studentPhone = (body.phone || '').trim();
    if (!programSlug || !studentName || !studentEmail) {
      return new Response(JSON.stringify({ status: 'error', message: 'Missing required fields' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    var program = await db.prepare(
      'SELECT id, title, slug, price, price_label, sample_content, full_content, status FROM programs WHERE slug = ?'
    ).bind(programSlug).first();
    if (!program) {
      return new Response(JSON.stringify({ status: 'error', message: 'Program not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      });
    }
    if (program.status !== 'active') {
      return new Response(JSON.stringify({ status: 'error', message: 'This program is not yet available. It is currently: ' + program.status }), {
        status: 403, headers: { 'Content-Type': 'application/json' }
      });
    }

    // Paid programs get 'sample' status, free programs get 'active' (full access)
    var enrollmentStatus = program.price > 0 ? 'sample' : 'active';

    var existing = await db.prepare(
      'SELECT id FROM enrollments WHERE program_id = ? AND student_email = ?'
    ).bind(program.id, studentEmail).first();
    if (existing) {
      return new Response(JSON.stringify({ status: 'error', message: 'You are already enrolled in this program' }), {
        status: 409, headers: { 'Content-Type': 'application/json' }
      });
    }

    var token = genToken();

    await db.prepare(
      'INSERT INTO enrollments (program_id, student_name, student_email, student_phone, access_token, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(program.id, studentName, studentEmail, studentPhone, token, enrollmentStatus).run();

    if (env.BREVO_API_KEY) {
      try {
        var dashUrl = 'https://gideonabochie.org/dashboard/?token=' + token;
        var accessLevel = program.price > 0 ? 'free sample module' : 'full access';
        var emailHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#F4F6FA;font-family:Georgia,serif"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px"><table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06)"><tr><td style="background:#0A1628;padding:32px;text-align:center"><h1 style="font-family:Georgia,serif;color:#C9A84C;font-size:24px;margin:0">GideonAbochie Studio</h1><p style="color:#6B7F9A;font-size:12px;margin:8px 0 0">Welcome to the ' + program.title + '</p></td></tr><tr><td style="padding:32px"><p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 16px">Dear ' + studentName + ',</p><p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 20px">Welcome to the <strong>' + program.title + '</strong>. You now have ' + accessLevel + ' and your private dashboard.</p><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:0 0 20px"><a href="' + dashUrl + '" style="display:inline-block;padding:14px 32px;border-radius:8px;background:#C9A84C;color:#0A1628;font-family:Georgia,serif;font-size:14px;font-weight:700;text-decoration:none">Access Your Dashboard</a></td></tr></table><p style="color:#64748B;font-size:12px;line-height:1.5;margin:0">If the button doesn\'t work, copy this link into your browser:</p><p style="color:#C9A84C;font-size:12px;font-family:monospace;word-break:break-all;margin:8px 0 0">' + dashUrl + '</p></td></tr><tr><td style="padding:16px 32px;border-top:1px solid #E2E8F0"><p style="color:#94A3B8;font-size:10px;margin:0">GideonAbochie Studio &mdash; Accra, Ghana</p></td></tr></table></td></tr></table></body></html>';

        await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
          body: JSON.stringify({
            sender: { name: 'GideonAbochie Studio', email: 'newsletter@gideonabochie.org' },
            to: [{ email: studentEmail, name: studentName }],
            subject: 'Welcome to ' + program.title + ' — GideonAbochie Studio',
            htmlContent: emailHtml
          })
        });
      } catch (_e) {}

      // Queue day-3 enrollment follow-up
      try {
        var dashUrl = 'https://gideonabochie.org/dashboard/?token=' + token;
        var followupHtml = enrollmentFollowup(studentName, program.title, dashUrl);
        await queueEmail(env, studentEmail, studentName, 'Getting Started with ' + program.title + ' — GideonAbochie Studio', followupHtml, 'enrollment_followup', daysFromNow(3));
      } catch (_e) {}
    }

    return new Response(JSON.stringify({
      status: 'ok',
      enrollment: {
        program_title: program.title,
        program_slug: program.slug,
        program_price: program.price,
        student_name: studentName,
        student_email: studentEmail,
        access_token: token,
        access_level: enrollmentStatus === 'sample' ? 'sample' : 'full',
        sample_content: program.sample_content
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
