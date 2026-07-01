import { requireAdmin } from '../_auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;
  try {
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const source = url.searchParams.get('source') || '';
      const status = url.searchParams.get('status') || '';
      let sql = "SELECT * FROM tasks";
      const conditions = [];
      const params = [];
      if (source) { conditions.push("source = ?"); params.push(source); }
      if (status) { conditions.push("status = ?"); params.push(status); }
      if (conditions.length) sql += " WHERE " + conditions.join(" AND ");
      sql += " ORDER BY phase ASC, priority DESC, created_at DESC";
      const { results } = await env.DB.prepare(sql).bind(...params).all();
      return new Response(JSON.stringify({ status: 'ok', items: results, count: results.length }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (request.method === 'POST') {
      const body = await request.json();
      const { title, description, phase, status, source, priority } = body;
      if (!title || !title.trim()) {
        return new Response(JSON.stringify({ status: 'error', message: 'Title is required' }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        });
      }
      const result = await env.DB.prepare(
        "INSERT INTO tasks (title, description, phase, status, source, priority) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(
        title.trim(), description || '', phase || 0,
        status || 'pending', source || 'manual', priority || 'medium'
      ).run();
      const task = await env.DB.prepare("SELECT * FROM tasks WHERE id = ?").bind(result.meta.last_row_id).first();
      return new Response(JSON.stringify({ status: 'ok', task }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (request.method === 'PUT') {
      const url = new URL(request.url);
      const id = url.searchParams.get('id');
      if (!id) {
        return new Response(JSON.stringify({ status: 'error', message: 'Task ID required' }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        });
      }
      const body = await request.json();
      const fields = [];
      const params = [];
      if (body.title !== undefined) { fields.push("title = ?"); params.push(body.title); }
      if (body.description !== undefined) { fields.push("description = ?"); params.push(body.description); }
      if (body.phase !== undefined) { fields.push("phase = ?"); params.push(body.phase); }
      if (body.status !== undefined) { fields.push("status = ?"); params.push(body.status); }
      if (body.priority !== undefined) { fields.push("priority = ?"); params.push(body.priority); }
      if (fields.length === 0) {
        return new Response(JSON.stringify({ status: 'error', message: 'No fields to update' }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        });
      }
      fields.push("updated_at = datetime('now')");
      params.push(id);
      await env.DB.prepare("UPDATE tasks SET " + fields.join(", ") + " WHERE id = ?").bind(...params).run();
      const task = await env.DB.prepare("SELECT * FROM tasks WHERE id = ?").bind(id).first();
      return new Response(JSON.stringify({ status: 'ok', task }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (request.method === 'DELETE') {
      const url = new URL(request.url);
      const id = url.searchParams.get('id');
      if (!id) {
        return new Response(JSON.stringify({ status: 'error', message: 'Task ID required' }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        });
      }
      await env.DB.prepare("DELETE FROM tasks WHERE id = ?").bind(id).run();
      return new Response(JSON.stringify({ status: 'ok', message: 'Deleted' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
