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
    var email = (body.email || '').trim().toLowerCase();
    var accessCode = (body.access_code || '').trim();
    if (!email || !accessCode) {
      return new Response(JSON.stringify({ status: 'error', message: 'Email and access code are required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    var student = await db.prepare(
      'SELECT id, name, email FROM students WHERE email = ? AND access_code = ?'
    ).bind(email, accessCode).first();
    if (!student) {
      return new Response(JSON.stringify({ status: 'error', message: 'Invalid email or access code' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }
    var enrollments = await db.prepare(
      `SELECT e.access_token, e.status, p.title AS program_title, p.slug AS program_slug
       FROM enrollments e JOIN programs p ON e.program_id = p.id
       WHERE e.student_email = ?
       ORDER BY e.enrolled_at DESC`
    ).bind(email).all();
    return new Response(JSON.stringify({
      status: 'ok',
      student: { id: student.id, name: student.name, email: student.email },
      enrollments: enrollments.results || []
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
