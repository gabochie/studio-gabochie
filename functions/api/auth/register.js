export async function onRequest(context) {
  var { request, env } = context;
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ status: 'error', message: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  }
  var db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
    var body = await request.json();
    var name = (body.name || '').trim();
    var email = (body.email || '').trim().toLowerCase();
    var phone = (body.phone || '').trim();
    var accessCode = (body.access_code || '').trim();
    if (!name || !email || !accessCode) {
      return new Response(JSON.stringify({ status: 'error', message: 'Name, email, and access code are required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    if (accessCode.length < 4) {
      return new Response(JSON.stringify({ status: 'error', message: 'Access code must be at least 4 characters' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    if (!email.includes('@')) {
      return new Response(JSON.stringify({ status: 'error', message: 'Invalid email address' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    var existing = await db.prepare('SELECT id FROM students WHERE email = ?').bind(email).first();
    if (existing) {
      return new Response(JSON.stringify({ status: 'error', message: 'An account with this email already exists' }), {
        status: 409, headers: { 'Content-Type': 'application/json' }
      });
    }
    await db.prepare(
      'INSERT INTO students (name, email, phone, access_code) VALUES (?, ?, ?, ?)'
    ).bind(name, email, phone, accessCode).run();
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
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
