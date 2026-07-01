import { requireAdmin } from '../../_auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;
  if (!env.DB) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), { status: 501, headers: { 'Content-Type': 'application/json' } });
  }

  const url = new URL(request.url);
  const method = request.method;

  try {
    // GET /admin/api/newsletter/calendar?year=2026
    if (method === 'GET') {
      const year = parseInt(url.searchParams.get('year'), 10) || new Date().getFullYear();
      const rows = await env.DB.prepare(
        "SELECT date_key, issue_number, theme, status, tags FROM newsletter_calendar WHERE year = ? ORDER BY date_key"
      ).bind(year).all();

      var issues = {};
      (rows.results || []).forEach(function(r) {
        var tags = [];
        try { tags = JSON.parse(r.tags || '[]'); } catch(_e) {}
        issues[r.date_key] = {
          theme: r.theme || '',
          status: r.status || 'planned',
          tags: tags
        };
      });

      return new Response(JSON.stringify({ status: 'ok', year: year, issues: issues }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // PUT /admin/api/newsletter/calendar — upsert issues
    if (method === 'PUT') {
      const body = await request.json();
      const { year, issues } = body;
      if (!year || !issues || typeof issues !== 'object') {
        return new Response(JSON.stringify({ status: 'error', message: 'year and issues object required' }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        });
      }

      const dateKeys = Object.keys(issues);
      let saved = 0;
      for (const dateKey of dateKeys) {
        const issue = issues[dateKey];
        if (!issue) continue;

        var existing = await env.DB.prepare(
          "SELECT id FROM newsletter_calendar WHERE year = ? AND date_key = ?"
        ).bind(year, dateKey).first();

        if (existing) {
          await env.DB.prepare(
            "UPDATE newsletter_calendar SET theme = ?, status = ?, tags = ?, updated_at = datetime('now') WHERE id = ?"
          ).bind(
            issue.theme || '',
            issue.status || 'planned',
            JSON.stringify(issue.tags || []),
            existing.id
          ).run();
        } else {
          await env.DB.prepare(
            "INSERT INTO newsletter_calendar (year, date_key, theme, status, tags) VALUES (?, ?, ?, ?, ?)"
          ).bind(
            year, dateKey,
            issue.theme || '',
            issue.status || 'planned',
            JSON.stringify(issue.tags || [])
          ).run();
        }
        saved++;
      }

      return new Response(JSON.stringify({ status: 'ok', message: 'Calendar saved', saved: saved }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
