export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!env.DB) return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });

  try {
    await env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL, entity_type TEXT NOT NULL DEFAULT '', entity_id TEXT DEFAULT '', admin_key TEXT DEFAULT '', ip TEXT DEFAULT '', details TEXT DEFAULT '{}', created_at TEXT NOT NULL DEFAULT (datetime('now')))"
    ).run();
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action)").run();
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at)").run();

    if (request.method === 'GET') {
      var limit = parseInt(new URL(request.url).searchParams.get('limit') || '50');
      var results = (await env.DB.prepare("SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?").bind(limit).all()).results || [];
      return new Response(JSON.stringify({ status: 'ok', items: results }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    if (request.method === 'POST') {
      var body = await request.json();
      var { action, entity_type, entity_id, admin_key, details } = body;
      if (!action) return new Response(JSON.stringify({ status: 'error', message: 'action required' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      await env.DB.prepare(
        "INSERT INTO audit_log (action, entity_type, entity_id, admin_key, ip, details) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(action, entity_type || '', entity_id || '', admin_key || '', request.headers.get('CF-Connecting-IP') || '', JSON.stringify(details || {})).run();
      return new Response(JSON.stringify({ status: 'ok' }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  }
}
