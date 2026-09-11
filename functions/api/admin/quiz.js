import { requireAdminAuth } from './_admin-auth.js';

export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!env.DB) return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  var authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  try {
    if (request.method === 'GET') {
      var url = new URL(request.url);
      var programId = url.searchParams.get('program_id') || '';
      var rows;
      if (programId) {
        rows = (await env.DB.prepare(
          'SELECT id, program_id, question, options, correct_answer, sort_order FROM quiz_questions WHERE program_id = ? ORDER BY sort_order ASC, id ASC'
        ).bind(programId).all()).results || [];
      } else {
        rows = (await env.DB.prepare(
          'SELECT qq.id, qq.program_id, qq.question, qq.options, qq.correct_answer, qq.sort_order, p.title AS program_title FROM quiz_questions qq JOIN programs p ON qq.program_id = p.id ORDER BY p.title, qq.sort_order ASC, qq.id ASC'
        ).all()).results || [];
      }
      return new Response(JSON.stringify({ status: 'ok', items: rows }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    if (request.method === 'POST') {
      var body = await request.json();
      var action = body.action || '';

      if (action === 'add') {
        var result = await env.DB.prepare(
          'INSERT INTO quiz_questions (program_id, question, options, correct_answer, sort_order) VALUES (?, ?, ?, ?, ?)'
        ).bind(body.program_id, body.question, JSON.stringify(body.options), body.correct_answer, body.sort_order || 0).run();
        return new Response(JSON.stringify({ status: 'ok', id: result.meta.last_row_id }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      }

      if (action === 'update') {
        if (!body.id) return new Response(JSON.stringify({ status: 'error', message: 'Missing question id' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
        await env.DB.prepare(
          'UPDATE quiz_questions SET question = ?, options = ?, correct_answer = ?, sort_order = ? WHERE id = ?'
        ).bind(body.question, JSON.stringify(body.options), body.correct_answer, body.sort_order || 0, body.id).run();
        return new Response(JSON.stringify({ status: 'ok' }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      }

      if (action === 'delete') {
        if (!body.id) return new Response(JSON.stringify({ status: 'error', message: 'Missing question id' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
        await env.DB.prepare('DELETE FROM quiz_questions WHERE id = ?').bind(body.id).run();
        return new Response(JSON.stringify({ status: 'ok' }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      }

      return new Response(JSON.stringify({ status: 'error', message: 'Unknown action' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  }
}
