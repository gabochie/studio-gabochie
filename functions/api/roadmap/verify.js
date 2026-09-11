export async function onRequest(context) {
  var db = context.env.DB;
  if (!db) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }
  var { request } = context;

  if (request.method === 'GET') {
    try {
      var manualPhases = await db.prepare('SELECT phase, verified_at, verified_by FROM phase_verifications ORDER BY phase').all();
      // Auto-verify phases where all tasks are done
      var tasksByPhase = await db.prepare(
        "SELECT phase, COUNT(*) AS total, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done_count FROM tasks WHERE phase > 0 GROUP BY phase"
      ).all();
      var autoVerified = [];
      (tasksByPhase.results || []).forEach(function(t) {
        if (t.total > 0 && t.total === t.done_count) {
          autoVerified.push({ phase: t.phase, verified_by: 'auto', verified_at: null });
        }
      });
      // Merge: manual takes precedence (appears first), auto fills gaps
      var seen = {};
      var merged = [];
      (manualPhases.results || []).forEach(function(p) { seen[p.phase] = true; merged.push(p); });
      autoVerified.forEach(function(p) {
        if (!seen[p.phase]) { seen[p.phase] = true; merged.push(p); }
      });
      return new Response(JSON.stringify({ status: 'ok', phases: merged }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (_err) {
      return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  if (request.method === 'PUT') {
    try {
      var body = await request.json();
      var phase = parseInt(body.phase);
      if (!phase) {
        return new Response(JSON.stringify({ status: 'error', message: 'Missing phase' }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        });
      }
      await db.prepare('INSERT OR IGNORE INTO phase_verifications (phase, verified_by) VALUES (?, ?)')
        .bind(phase, body.verified_by || 'admin').run();
      return new Response(JSON.stringify({ status: 'ok', phase: phase, verified: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (_err) {
      return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405, headers: { 'Content-Type': 'application/json' }
  });
}
