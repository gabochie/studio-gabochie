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
    if (!email) {
      return new Response(JSON.stringify({ status: 'error', message: 'Email is required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    // Find all enrollments for this email
    var enrollments = await db.prepare(
      `SELECT e.access_token, e.status, p.title AS program_title, p.slug AS program_slug
       FROM enrollments e JOIN programs p ON e.program_id = p.id
       WHERE e.student_email = ?
       ORDER BY e.enrolled_at DESC`
    ).bind(email).all();
    if (!enrollments.results || enrollments.results.length === 0) {
      return new Response(JSON.stringify({ status: 'error', message: 'No enrollment found for this email' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      });
    }
    // If single enrollment, return its token directly
    if (enrollments.results.length === 1) {
      return new Response(JSON.stringify({
        status: 'ok',
        token: enrollments.results[0].access_token,
        program_title: enrollments.results[0].program_title,
        program_slug: enrollments.results[0].program_slug,
        enrollment_status: enrollments.results[0].status
      }), { headers: { 'Content-Type': 'application/json' } });
    }
    // Multiple enrollments — return list
    return new Response(JSON.stringify({
      status: 'ok',
      multiple: true,
      enrollments: enrollments.results.map(function(e) {
        return { token: e.access_token, program_title: e.program_title, program_slug: e.program_slug, status: e.status };
      })
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
