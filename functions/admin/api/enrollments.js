export async function onRequest(context) {
  var { request, env } = context;
  var db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
    var rows = await db.prepare(
      'SELECT e.id, e.student_name, e.student_email, e.student_phone, e.status, e.payment_ref, e.payment_amount, e.enrolled_at, p.title AS program_title, p.slug AS program_slug FROM enrollments e JOIN programs p ON e.program_id = p.id ORDER BY e.enrolled_at DESC'
    ).all();
    var count = rows.results ? rows.results.length : 0;
    return new Response(JSON.stringify({ status: 'ok', count: count, items: rows.results || [] }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
