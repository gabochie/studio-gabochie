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
    return new Response(JSON.stringify({ status: 'error', message: err.message }), {
      status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  }
}
