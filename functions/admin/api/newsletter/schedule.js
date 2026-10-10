import { requireAdminAuth } from '../../../api/admin/_admin-auth.js';
import { callAI } from '../../../api/agents/_ai.js';
import { enqueueBroadcast } from './_enqueue.js';

var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key, X-CI-Secret' };

// Saturday (UTC) of the week containing the given date, as YYYY-MM-DD.
export function saturdayOfWeek(d) {
  const dt = d instanceof Date ? new Date(d.getTime()) : new Date(d);
  const day = dt.getUTCDay();
  const diff = (6 - day + 7) % 7;
  dt.setUTCDate(dt.getUTCDate() + diff);
  return dt.toISOString().slice(0, 10);
}

// Saturday 06:00+ UTC gate. Returns this Saturday's date (YYYY-MM-DD)
// when a scheduled send is due, else null. Pure function for tests.
export function saturdaySendDue(now) {
  const dt = now instanceof Date ? now : new Date(now);
  if (dt.getUTCDay() !== 6 || dt.getUTCHours() < 6) return null;
  return dt.toISOString().slice(0, 10);
}

// Parse AI output: first SUBJECT: line is the subject, rest is the body.
export function parseDraft(text) {
  const lines = String(text || '').split('\n');
  let subject = '';
  const body = [];
  for (const line of lines) {
    const m = line.match(/^\s*SUBJECT:\s*(.+)\s*$/i);
    if (m && !subject) {
      subject = m[1].trim();
    } else {
      body.push(line);
    }
  }
  return { subject: subject, html: body.join('\n').trim() };
}

async function authed(request, env) {
  const ciAuth = request.headers.get('X-CI-Secret');
  if (ciAuth && env.CI_WEBHOOK_SECRET && ciAuth === env.CI_WEBHOOK_SECRET) return null;
  return requireAdminAuth(request, env);
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const authErr = await authed(request, env);
  if (authErr) return authErr;
  if (!env.DB) return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });

  try {
    if (request.method === 'GET') {
      const { results } = await env.DB.prepare(
        'SELECT id, week_of, topic, subject, theme, status, created_by, approved_by, approved_at, issue_id, created_at, updated_at FROM newsletter_schedule ORDER BY week_of DESC LIMIT 12'
      ).all();
      return new Response(JSON.stringify({ status: 'ok', schedule: results || [] }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }
    const body = await request.json().catch(function () { return {}; });
    const action = body.action || '';

    if (action === 'draft') {
      const topic = String(body.topic || '').trim() || 'faithful creativity for the week ahead';
      const weekOf = body.week_of || saturdayOfWeek(new Date());
      const weekRows = await env.DB.prepare('SELECT id, status FROM newsletter_schedule WHERE week_of = ?').bind(weekOf).all();
      const live = (weekRows.results || []).filter(function (r) { return r.status !== 'skipped'; });
      if (live.length) {
        return new Response(JSON.stringify({ status: 'error', message: 'A draft already exists for week of ' + weekOf }), { status: 409, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      }
      const systemPrompt = 'You are a newsletter writer for Studio Gabochie — a Bible-based school of creativity, love, and wisdom based in Ghana. Write engaging, warm newsletter content that teaches, inspires, and connects readers to the mission. Use clear headings, short paragraphs, and a conversational tone. Include a call to action at the end.';
      const userPrompt = 'Write a newsletter issue for Studio Gabochie.\n\nTopic: ' + topic + '\nAudience: African youth and creatives\nTone: warm and professional\n\nInclude: a catchy subject line (prefixed with SUBJECT:), an opening hook, teaching content with 2-3 sections, and a call to action. Sign off as "Gideon Abochie".';
      const result = await callAI(env, systemPrompt, userPrompt, { model: 'gpt-4o-mini', temperature: 0.7, max_tokens: 2048 });
      if (result.error) {
        return new Response(JSON.stringify({ status: 'error', message: result.error }), { status: 502, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      }
      const parsed = parseDraft(result.content);
      const ins = await env.DB.prepare(
        "INSERT INTO newsletter_schedule (week_of, topic, subject, theme, html, status, created_by) VALUES (?, ?, ?, ?, ?, 'draft', 'ai')"
      ).bind(weekOf, topic, parsed.subject, topic, parsed.html).run();
      const id = ins && ins.meta ? ins.meta.last_row_id : 0;
      return new Response(JSON.stringify({ status: 'ok', id: id, week_of: weekOf, subject: parsed.subject }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    if (action === 'approve') {
      const id = parseInt(body.id, 10) || 0;
      const row = await env.DB.prepare('SELECT id, subject, html, status FROM newsletter_schedule WHERE id = ?').bind(id).first();
      if (!row) {
        return new Response(JSON.stringify({ status: 'error', message: 'Scheduled issue not found' }), { status: 404, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      }
      if (row.status !== 'draft') {
        return new Response(JSON.stringify({ status: 'error', message: 'Only drafts can be approved' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      }
      if (!row.subject || !row.html) {
        return new Response(JSON.stringify({ status: 'error', message: 'Draft needs a subject and body before approval' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      }
      const by = String(body.approved_by || 'admin').slice(0, 80);
      await env.DB.prepare("UPDATE newsletter_schedule SET status = 'approved', approved_by = ?, approved_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").bind(by, id).run();
      return new Response(JSON.stringify({ status: 'ok', id: id }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    if (action === 'send-now') {
      const id = parseInt(body.id, 10) || 0;
      const row = await env.DB.prepare('SELECT id, subject, theme, html, status FROM newsletter_schedule WHERE id = ?').bind(id).first();
      if (!row) {
        return new Response(JSON.stringify({ status: 'error', message: 'Scheduled issue not found' }), { status: 404, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      }
      if (row.status !== 'approved') {
        return new Response(JSON.stringify({ status: 'error', message: 'Only approved issues can be sent' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      }
      const result = await enqueueBroadcast(env, { subject: row.subject, theme: row.theme, html: row.html });
      if (!result.ok) {
        return new Response(JSON.stringify({ status: 'error', message: result.error }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      }
      await env.DB.prepare("UPDATE newsletter_schedule SET status = 'queued', issue_id = ?, updated_at = datetime('now') WHERE id = ?").bind(result.issueId, id).run();
      return new Response(JSON.stringify({ status: 'ok', id: id, issue_number: result.issueNumber, enqueued: result.enqueued }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    return new Response(JSON.stringify({ error: 'Unknown action. Use: draft, approve, send-now' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  }
}
