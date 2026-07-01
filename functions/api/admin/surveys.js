import { requireAdminAuth } from './_admin-auth.js';

export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!env.DB) return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  var authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  try {
    if (request.method === 'GET') {
      var url = new URL(request.url);

      if (url.searchParams.get('export') === 'csv') {
        var all = (await env.DB.prepare("SELECT * FROM survey_responses ORDER BY created_at DESC").all()).results || [];
        var header = 'ID,Name,Phone,Topic,Learning Style,Time Commitment,Source,Source URL,Recommendation,Recommended Program,Created At';
        var csvRows = all.map(function(r) {
          return [
            r.id,
            '"' + (r.name || '').replace(/"/g,'""') + '"',
            '"' + (r.phone || '').replace(/"/g,'""') + '"',
            '"' + (r.topic || '').replace(/"/g,'""') + '"',
            '"' + (r.learning_style || '').replace(/"/g,'""') + '"',
            '"' + (r.time_commitment || '').replace(/"/g,'""') + '"',
            '"' + (r.source || '').replace(/"/g,'""') + '"',
            '"' + (r.source_url || '').replace(/"/g,'""') + '"',
            '"' + (r.recommendation || '').replace(/"/g,'""') + '"',
            '"' + (r.recommended_program || '').replace(/"/g,'""') + '"',
            r.created_at || ''
          ].join(',');
        }).join('\n');
        return new Response('\uFEFF' + header + '\n' + csvRows, {
          headers: Object.assign({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="survey-responses.csv"' }, cors)
        });
      }

      var topicFilter = url.searchParams.get('topic') || '';
      var rows;
      if (topicFilter) {
        rows = (await env.DB.prepare(
          "SELECT * FROM survey_responses WHERE topic = ? ORDER BY created_at DESC LIMIT 200"
        ).bind(topicFilter).all()).results || [];
      } else {
        rows = (await env.DB.prepare(
          "SELECT * FROM survey_responses ORDER BY created_at DESC LIMIT 200"
        ).all()).results || [];
      }

      var counts = (await env.DB.prepare(
        "SELECT topic, COUNT(*) AS c FROM survey_responses GROUP BY topic ORDER BY c DESC"
      ).all()).results || [];

      return new Response(JSON.stringify({ status: 'ok', items: rows, topic_counts: counts }), {
        headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  }
}
