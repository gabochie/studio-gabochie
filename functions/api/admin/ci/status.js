export async function onRequest(context) {
  var { request, env } = context;

  if (request.method === 'POST') {
    var auth = request.headers.get('X-CI-Secret');
    if (!auth || auth !== env.CI_WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ status: 'error', message: 'Unauthorized' }), {
        status: 403, headers: { 'Content-Type': 'application/json' }
      });
    }
    try {
      var body = await request.json();
      if (!body.run_id) {
        return new Response(JSON.stringify({ status: 'error', message: 'Missing run_id' }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        });
      }
      await env.DB.prepare(
        "INSERT INTO ci_reports (run_id, status, test_count, test_passed, test_failed, coverage_pct, branch, triggered_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        String(body.run_id), String(body.status || 'unknown'),
        Number(body.test_count || 0), Number(body.test_passed || 0),
        Number(body.test_failed || 0), Number(body.coverage_pct || 0),
        String(body.branch || 'main'), String(body.triggered_by || 'manual')
      ).run();
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (_err) {
      return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // GET — latest report
  try {
    var report = await env.DB.prepare(
      "SELECT * FROM ci_reports ORDER BY created_at DESC LIMIT 1"
    ).first();
    return new Response(JSON.stringify({ status: 'ok', report: report || null }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
