import { callAI } from '../agents/_ai.js';
import { requireAdmin } from '../../admin/_auth.js';

var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key, X-CI-Secret' };

function slugify(s) {
  return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'untitled';
}

// Split AI output into title/excerpt/html. Expects first line # Title,
// optional > excerpt line, then HTML body. Falls back gracefully.
export function parseDraft(text) {
  var lines = String(text || '').split('\n');
  var title = '';
  var excerpt = '';
  var body = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    var h = line.match(/^#\s+(.+)$/);
    if (h && !title) {
      title = h[1].trim();
      continue;
    }
    var q = line.match(/^>\s*(.+)$/);
    if (q && !excerpt && !title) {
      continue;
    }
    if (q && !excerpt) {
      excerpt = q[1].trim();
      continue;
    }
    body.push(lines[i]);
  }
  return { title: title, excerpt: excerpt, html: body.join('\n').trim() };
}

async function authed(request, env) {
  var ci = request.headers.get('X-CI-Secret');
  if (ci && env.CI_WEBHOOK_SECRET && ci === env.CI_WEBHOOK_SECRET) return null;
  return requireAdmin(request, env);
}

export async function onRequest(context) {
  var { request, env } = context;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), { status: 405, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  }
  var authErr = await authed(request, env);
  if (authErr) return authErr;
  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  }
  try {
    var body = await request.json().catch(function () { return {}; });
    var topic = String(body.topic || '').trim();
    if (!topic) {
      return new Response(JSON.stringify({ error: 'topic is required' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }
    var systemPrompt = 'You are a senior essayist for Studio Gabochie — a Bible-based school of creativity, love, and wisdom in Accra, Ghana. Write full blog posts in clean HTML using only <h2>, <h3>, <p>, <ul>/<ol> with <li>, <blockquote>. No <script> tags, no markdown. Warm, direct, zero fluff. Accra and Ghanaian examples where natural.';
    var userPrompt = 'Write a complete blog post as clean HTML.\n\nTopic: ' + topic + '\nAudience: African youth and creatives\nTone: warm and professional\n\nLength: 700-1000 words. Start with a line "# <catchy title>", then a line "> <one-sentence excerpt>", then the HTML body. Hook first, one practical framework with Ghanaian examples, single next step to close. End with 2-3 FAQs as <h3> questions with answers (they will be extracted separately).';
    var result = await callAI(env, systemPrompt, userPrompt, { model: 'gpt-4o-mini', temperature: 0.7, max_tokens: 3000 });
    if (result.error) {
      return new Response(JSON.stringify({ error: result.error }), { status: 502, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }
    var parsed = parseDraft(result.content);
    if (!parsed.title || !parsed.html) {
      return new Response(JSON.stringify({ error: 'AI output unparseable' }), { status: 502, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }
    var slug = slugify(parsed.title);
    var dupe = await env.DB.prepare('SELECT id FROM posts WHERE slug = ?').bind(slug).first();
    if (dupe) slug = slug + '-' + Date.now().toString(36);
    var now = new Date().toISOString();
    var clean = String(parsed.html).replace(/<script[\s\S]*?<\/script\s*>/gi, '');
    var ins = await env.DB.prepare(
      'INSERT INTO posts (slug, title, excerpt, html, cover_image, tags, faqs, status, author, published_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(slug, parsed.title.slice(0, 200), parsed.excerpt.slice(0, 500), clean, '', JSON.stringify(['ai-draft']), JSON.stringify([]), 'draft', 'Gideon Abochie', '', now).run();
    return new Response(JSON.stringify({ status: 'ok', id: ins.meta.last_row_id, slug: slug, title: parsed.title }), {
      headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  }
}
