import { requireAdminAuth } from '../../api/admin/_admin-auth.js';

export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!env.DB) return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  var authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  try {
    var url = new URL(request.url);
    var runId = url.searchParams.get('run_id');
    var summary = url.searchParams.get('summary');

    if (summary === '1') {
      // Aggregated summary for dashboard widget
      var latestRun = (await env.DB.prepare(
        "SELECT id, trigger, status, total_checks, passed_checks, failed_checks, warn_checks, started_at, completed_at, created_at FROM quality_runs ORDER BY id DESC LIMIT 1"
      ).all()).results || [];
      var recentRuns = (await env.DB.prepare(
        "SELECT id, trigger, status, total_checks, passed_checks, failed_checks, created_at FROM quality_runs ORDER BY id DESC LIMIT 10"
      ).all()).results || [];

      // Aggregate pass rate across all runs
      var totals = (await env.DB.prepare(
        "SELECT COALESCE(SUM(passed_checks),0) AS total_passed, COALESCE(SUM(failed_checks),0) AS total_failed, COALESCE(SUM(total_checks),0) AS total_all FROM quality_runs WHERE status = 'completed'"
      ).all()).results || [];
      var agg = totals[0] || { total_passed: 0, total_failed: 0, total_all: 0 };

      // Category breakdown from latest run
      var categories = [];
      if (latestRun.length) {
        categories = (await env.DB.prepare(
          "SELECT category, COUNT(*) AS count, SUM(CASE WHEN status='pass' THEN 1 ELSE 0 END) AS passed, SUM(CASE WHEN status='fail' THEN 1 ELSE 0 END) AS failed, SUM(CASE WHEN status='warn' THEN 1 ELSE 0 END) AS warned FROM quality_reports WHERE run_id = ? GROUP BY category"
        ).bind(latestRun[0].id).all()).results || [];
      }

      return new Response(JSON.stringify({ status: 'ok', latest_run: latestRun[0] || null, recent_runs: recentRuns, totals: agg, categories: categories }), {
        headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }

    if (runId) {
      var run = (await env.DB.prepare("SELECT * FROM quality_runs WHERE id = ?").bind(runId).all()).results || [];
      if (!run.length) {
        return new Response(JSON.stringify({ status: 'error', message: 'Run not found' }), { status: 404, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      }
      var reports = (await env.DB.prepare(
        "SELECT id, category, page_url, check_name, status, message, created_at FROM quality_reports WHERE run_id = ? ORDER BY category, page_url, id"
      ).bind(runId).all()).results || [];
      var cat = {};
      reports.forEach(function(r) {
        if (!cat[r.category]) cat[r.category] = [];
        cat[r.category].push(r);
      });
      return new Response(JSON.stringify({ status: 'ok', run: run[0], reports_by_category: cat, reports: reports }), {
        headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }

    // List recent runs
    var runs = (await env.DB.prepare(
      "SELECT id, trigger, status, total_checks, passed_checks, failed_checks, warn_checks, started_at, completed_at, created_at FROM quality_runs ORDER BY id DESC LIMIT 25"
    ).all()).results || [];

    return new Response(JSON.stringify({ status: 'ok', runs: runs }), {
      headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  }
}
