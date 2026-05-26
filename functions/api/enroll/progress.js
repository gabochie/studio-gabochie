export async function onRequest(context) {
  var { request, env } = context;
  var db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }
  var url = new URL(request.url);

  // GET /api/enroll/progress?token=xxx — return modules + completion status
  if (request.method === 'GET') {
    var token = url.searchParams.get('token') || '';
    if (!token) {
      return new Response(JSON.stringify({ status: 'error', message: 'Missing token' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    try {
      var enrollment = await db.prepare(
        'SELECT id, program_id, status FROM enrollments WHERE access_token = ?'
      ).bind(token).first();
      if (!enrollment) {
        return new Response(JSON.stringify({ status: 'error', message: 'Invalid token' }), {
          status: 404, headers: { 'Content-Type': 'application/json' }
        });
      }
      var modules = await db.prepare(
        `SELECT m.id, m.title, m.slug, m.description, m.sort_order,
                CASE WHEN mc.id IS NOT NULL THEN 1 ELSE 0 END AS completed,
                mc.completed_at
         FROM modules m
         LEFT JOIN module_completions mc ON mc.module_id = m.id AND mc.enrollment_id = ?
         WHERE m.program_id = ?
         ORDER BY m.sort_order ASC`
      ).bind(enrollment.id, enrollment.program_id).all();
      var total = modules.results.length;
      var done = modules.results.filter(function(m) { return m.completed === 1; }).length;
      return new Response(JSON.stringify({
        status: 'ok',
        enrollment_id: enrollment.id,
        program_id: enrollment.program_id,
        total_modules: total,
        completed_modules: done,
        progress_pct: total > 0 ? Math.round((done / total) * 100) : 0,
        modules: modules.results
      }), { headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
      return new Response(JSON.stringify({ status: 'error', message: err.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // POST /api/enroll/progress — mark a module as completed
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    var body = await request.json();
    var postToken = body.token || '';
    var moduleSlug = body.module_slug || '';
    if (!postToken || !moduleSlug) {
      return new Response(JSON.stringify({ status: 'error', message: 'Missing token or module_slug' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    var enrollment = await db.prepare(
      'SELECT id, program_id, status FROM enrollments WHERE access_token = ?'
    ).bind(postToken).first();
    if (!enrollment) {
      return new Response(JSON.stringify({ status: 'error', message: 'Invalid token' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      });
    }
    // Only allow completion marking for active enrollments
    if (enrollment.status !== 'active') {
      return new Response(JSON.stringify({ status: 'error', message: 'Full access required to track progress' }), {
        status: 403, headers: { 'Content-Type': 'application/json' }
      });
    }
    var moduleRow = await db.prepare(
      'SELECT id FROM modules WHERE slug = ? AND program_id = ?'
    ).bind(moduleSlug, enrollment.program_id).first();
    if (!moduleRow) {
      return new Response(JSON.stringify({ status: 'error', message: 'Module not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      });
    }
    await db.prepare(
      'INSERT OR IGNORE INTO module_completions (enrollment_id, module_id) VALUES (?, ?)'
    ).bind(enrollment.id, moduleRow.id).run();
    return new Response(JSON.stringify({ status: 'ok', module_slug: moduleSlug, completed: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
