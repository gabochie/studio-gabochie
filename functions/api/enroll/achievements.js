export async function onRequest(context) {
  var { request, env } = context;
  var db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }
  var url = new URL(request.url);
  var token = url.searchParams.get('token') || '';
  if (!token) {
    return new Response(JSON.stringify({ status: 'error', message: 'Missing token' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
    var enrollment = await db.prepare(
      'SELECT id, student_email, program_id FROM enrollments WHERE access_token = ?'
    ).bind(token).first();
    if (!enrollment) {
      return new Response(JSON.stringify({ status: 'error', message: 'Invalid token' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      });
    }
    var earned = await db.prepare(
      `SELECT sa.achievement_key, sa.earned_at, a.name, a.description, a.icon
       FROM student_achievements sa
       LEFT JOIN achievements a ON sa.achievement_key = a.key
       WHERE sa.enrollment_id = ?
       ORDER BY sa.earned_at ASC`
    ).bind(enrollment.id).all();
    return new Response(JSON.stringify({
      status: 'ok',
      achievements: earned.results || []
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
