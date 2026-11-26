import { requireAdminAuth } from '../_admin-auth.js';

// Compare secrets in constant time. Both inputs are hashed to fixed-length
// digests first, so a wrong-length guess cannot leak the expected length and
// every byte is examined regardless of where the first mismatch occurs.
async function safeEqual(a, b) {
  var encoder = new TextEncoder();
  var left = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(String(a || ''))));
  var right = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(String(b || ''))));
  var diff = 0;
  for (var i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key, X-CI-Secret' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  if (request.method === 'POST') {
    var auth = request.headers.get('X-CI-Secret');
    if (!auth || !env.CI_WEBHOOK_SECRET || !(await safeEqual(auth, env.CI_WEBHOOK_SECRET))) {
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

  // GET — latest report (admin-only)
  var authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;
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
