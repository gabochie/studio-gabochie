import { callAI } from '../agents/_ai.js';
import { requireAdminAuth } from '../admin/_admin-auth.js';

var corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key' };

var SYSTEM_PROMPTS = {
  newsletter: 'You are a newsletter writer for Studio Gabochie — a Bible-based school of creativity, love, and wisdom based in Ghana. Write engaging, warm newsletter content that teaches, inspires, and connects readers to the mission. Use clear headings, short paragraphs, and a conversational tone. Include a call to action at the end.',
  seo: 'You are an SEO specialist for studio.gabochie.com. Generate concise, keyword-rich meta titles (under 60 chars) and meta descriptions (under 160 chars) optimized for search engines. Output valid JSON only.',
  outline: 'You are a content strategist. Generate detailed blog post outlines with introduction points, 3-5 main sections with sub-points, conclusion, and suggested SEO keywords. Keep it practical and actionable.',
};

function buildPrompt(type, params) {
  var topic = params.topic || '';
  var audience = params.audience || 'African youth and creatives';
  var tone = params.tone || 'professional';

  switch (type) {
    case 'newsletter':
      return 'Write a newsletter issue for Studio Gabochie.\n\nTopic: ' + topic + '\nAudience: ' + audience + '\nTone: ' + tone + '\n\nInclude: a catchy subject line (prefixed with SUBJECT:), an opening hook, teaching content with 2-3 sections, and a call to action. Sign off as "Gideon Abochie".';
    case 'seo':
      return 'Generate SEO meta tags for a page on studio.gabochie.com.\n\nPage topic: ' + topic + '\nTarget audience: ' + audience + '\n\nRespond with JSON only: { "title": "...", "description": "...", "keywords": ["..."] }';
    case 'outline':
      return 'Generate a blog post outline.\n\nTopic: ' + topic + '\nTarget audience: ' + audience + '\nTone: ' + tone + '\n\nInclude suggested title, intro, 3-5 sections with sub-bullets, conclusion, and 3-5 SEO keywords.';
    default:
      return 'Write about: ' + topic;
  }
}

export async function onRequest(context) {
  var { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  var authError = await requireAdminAuth(request, env);
  if (authError) return authError;

  try {
    var body = await request.json();
    var type = body.type || 'newsletter';
    var topic = body.topic || '';
    var audience = body.audience || 'African youth and creatives';
    var tone = body.tone || 'professional';
    var model = body.model || 'gpt-4o-mini';

    if (!topic) {
      return new Response(JSON.stringify({ error: 'topic is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if (!SYSTEM_PROMPTS[type]) {
      return new Response(JSON.stringify({ error: 'Invalid type. Use: newsletter, seo, or outline' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    var systemPrompt = SYSTEM_PROMPTS[type];
    var userPrompt = buildPrompt(type, { topic: topic, audience: audience, tone: tone });

    var result = await callAI(env, systemPrompt, userPrompt, { model: model, temperature: 0.7, max_tokens: 2048 });

    if (result.error) {
      return new Response(JSON.stringify({ error: result.error }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    return new Response(JSON.stringify({ status: 'ok', type: type, content: result.content }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (_err) {
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
}
