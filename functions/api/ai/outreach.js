import { callAI } from '../agents/_ai.js';
import { queueEmail, daysFromNow } from '../email/_send.js';
import { queueWhatsApp } from '../_whatsapp.js';
import { requireAdminAuth } from '../admin/_admin-auth.js';
import { checkRateLimit } from '../_rate-limit.js';

var corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key' };

// Segments are bounded and respect consent: email requires a confirmed,
// non-suppressed address; WhatsApp requires an explicit whatsapp_opt_in.
var SEGMENTS = {
  active: { label: 'Active (last 30d)', sql: "SELECT DISTINCT s.email, s.name, s.phone, COALESCE(s.whatsapp_opt_in, 0) AS whatsapp_opt_in FROM subscribers s WHERE s.confirmed = 1 AND s.email != '' AND s.email NOT IN (SELECT email FROM suppression_list) AND s.email IN (SELECT email FROM events WHERE created_at >= datetime('now', '-30 days')) LIMIT 20" },
  dormant: { label: 'Dormant (31-90d)', sql: "SELECT DISTINCT s.email, s.name, s.phone, COALESCE(s.whatsapp_opt_in, 0) AS whatsapp_opt_in FROM subscribers s WHERE s.confirmed = 1 AND s.email != '' AND s.email NOT IN (SELECT email FROM suppression_list) AND s.email NOT IN (SELECT email FROM events WHERE created_at >= datetime('now', '-30 days')) AND s.created_at >= datetime('now', '-90 days') LIMIT 20" },
  churned: { label: 'Churned (90d+)', sql: "SELECT DISTINCT s.email, s.name, s.phone, COALESCE(s.whatsapp_opt_in, 0) AS whatsapp_opt_in FROM subscribers s WHERE s.confirmed = 1 AND s.email != '' AND s.email NOT IN (SELECT email FROM suppression_list) AND s.email NOT IN (SELECT email FROM events WHERE created_at >= datetime('now', '-90 days')) AND s.created_at <= datetime('now', '-90 days') LIMIT 20" },
  donors: { label: 'Donors', sql: "SELECT DISTINCT d.donor_email AS email, d.donor_name AS name, d.donor_phone AS phone, 0 AS whatsapp_opt_in FROM donations d WHERE d.status = 'successful' AND d.donor_email != '' AND d.donor_email NOT IN (SELECT email FROM suppression_list) AND d.created_at >= datetime('now', '-180 days') LIMIT 20" },
  students: { label: 'Students', sql: "SELECT DISTINCT t.email, t.name, t.student_phone AS phone, 0 AS whatsapp_opt_in FROM students t WHERE t.email != '' AND t.email NOT IN (SELECT email FROM suppression_list) AND t.created_at >= datetime('now', '-180 days') LIMIT 20" },
};

export async function onRequest(context) {
  var { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  var authError = await requireAdminAuth(request, env);
  if (authError) return authError;

  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  var url = new URL(request.url);
  var action = url.searchParams.get('action') || 'segments';

  try {
    if (request.method === 'GET' && action === 'segments') {
      var segments = {};
      for (var key in SEGMENTS) {
        try {
          var r = await env.DB.prepare(SEGMENTS[key].sql).all();
          segments[key] = { label: SEGMENTS[key].label, count: (r.results || []).length };
        } catch (e) {
          segments[key] = { label: SEGMENTS[key].label, count: 0, error: e.message };
        }
      }
      return new Response(JSON.stringify({ status: 'ok', segments: segments }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if (request.method === 'POST') {
      var ip = request.headers.get('CF-Connecting-IP') || '';
      if (!await checkRateLimit(env.DB, ip, 'outreach', 3, 300)) {
        return new Response(JSON.stringify({ error: 'Too many campaigns. Try again later.' }), { status: 429, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      var body = await request.json();
      var segment = body.segment || 'dormant';
      var subject = body.subject || '';
      var preview = body.preview || false;
      var channel = body.channel || 'email';

      if (!SEGMENTS[segment]) {
        return new Response(JSON.stringify({ error: 'Invalid segment' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }

      var suppRows = await env.DB.prepare('SELECT email FROM suppression_list').all().catch(function () { return { results: [] }; });
      var suppressed = new Set((suppRows.results || []).map(function (s) { return String(s.email || '').toLowerCase(); }));
      var usersResult = await env.DB.prepare(SEGMENTS[segment].sql).all();
      var users = (usersResult.results || []).filter(function (u) {
        // Belt-and-braces: never queue to a suppressed address even if the
        // segment query is running against a legacy schema.
        var email = String((u && (u.email || u.donor_email)) || '').toLowerCase();
        if (!email || suppressed.has(email)) return false;
        if (u && u.confirmed !== undefined && Number(u.confirmed) !== 1) return false;
        return true;
      });

      if (users.length === 0) {
        return new Response(JSON.stringify({ status: 'ok', message: 'No users in this segment', sent: 0 }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }

      var segmentLabel = SEGMENTS[segment].label;

      // Generate content via AI (different prompts per channel)
      var wantsWhatsApp = channel === 'whatsapp' || channel === 'both';
      var systemPrompt = wantsWhatsApp
        ? 'You are an outreach specialist for Studio Gabochie. Write warm, personal WhatsApp messages. Keep it under 300 characters. No HTML. No formatting.'
        : 'You are an outreach specialist for Studio Gabochie — a Bible-based school of creativity, love, and wisdom. Write warm, personal re-engagement emails. Keep it under 150 words. Use simple HTML with inline styles.';
      var userPrompt = wantsWhatsApp
        ? 'Write a WhatsApp re-engagement message for segment: ' + segmentLabel + '. The message should sound personal, remind them of our mission (creativity, love, wisdom), and include a CTA to visit studio.gabochie.com. Wrap subject in SUBJECT: and body in BODY:.'
        : 'Write a re-engagement email for the segment: ' + segmentLabel + '. Subject line: ' + (subject || 'We miss you — Studio Gabochie') + '. The email should sound personal, remind them of the mission, and include a clear CTA to visit studio.gabochie.com/school/. Wrap subject in SUBJECT: and body in BODY:.';

      var result = await callAI(env, systemPrompt, userPrompt, { model: 'gpt-4o-mini', temperature: 0.7, max_tokens: 800 });

      if (result.error) {
        return new Response(JSON.stringify({ error: result.error }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }

      var content = result.content || '';
      var subjectLine = subject || 'We miss you — Studio Gabochie';
      var bodyLines = content.split('BODY:');
      var messageBody = bodyLines.length > 1 ? bodyLines[1].trim() : content;

      if (!subject && content.includes('SUBJECT:')) {
        var subMatch = content.match(/SUBJECT:\s*(.+)/);
        if (subMatch) subjectLine = subMatch[1].trim();
      }

      if (preview) {
        return new Response(JSON.stringify({
          status: 'ok', preview: true, channel: channel,
          subject: subjectLine, body: messageBody,
          recipients: users.length, sampleUser: users[0]
        }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }

      var sent = 0;
      for (var i = 0; i < users.length; i++) {
        var user = users[i];
        var name = user.name || user.donor_name || '';
        var email = user.email || user.donor_email || '';
        var phone = user.phone || user.donor_phone || user.student_phone || '';

        if (channel === 'email' || channel === 'both') {
          if (!email) continue;
          var personalizedHtml = messageBody.replace(/\[name\]/g, name || 'Friend').replace(/{name}/g, name || 'Friend');
          try {
            await queueEmail(env, email, name || 'Friend', subjectLine, personalizedHtml, 'outreach_' + segment, daysFromNow(0));
            sent++;
          } catch (_e) {}
        }

        // WhatsApp is opt-in only. Donor/student segments deliberately expose
        // whatsapp_opt_in = 0; subscriber segments use the real consent flag.
        if (wantsWhatsApp && Number(user.whatsapp_opt_in) === 1) {
          if (!phone) continue;
          var personalizedMsg = messageBody.replace(/\[name\]/g, name || 'Friend').replace(/{name}/g, name || 'Friend').replace(/<[^>]+>/g, '');
          try {
            await queueWhatsApp(env, phone, personalizedMsg, 'outreach_' + segment, daysFromNow(0));
            sent++;
          } catch (_e) {}
        }
      }

      return new Response(JSON.stringify({
        status: 'ok', message: 'Queued ' + sent + ' messages via ' + channel,
        segment: segment, channel: channel, sent: sent
      }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // GET content recommendations for a user
    if (request.method === 'GET' && action === 'recommend') {
      var userEmail = url.searchParams.get('email') || '';
      if (!userEmail) {
        return new Response(JSON.stringify({ error: 'email param required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }

      var events = await env.DB.prepare('SELECT event_type, page FROM events WHERE email = ? ORDER BY created_at DESC LIMIT 10').bind(userEmail).all();
      var donations = await env.DB.prepare("SELECT amount, created_at FROM donations WHERE donor_email = ? AND status = 'successful' ORDER BY created_at DESC LIMIT 5").bind(userEmail).all();

      var profile = {
        email: userEmail,
        recentEvents: (events.results || []).map(function(e) { return e.event_type + (e.page ? ' on ' + e.page : ''); }),
        recentDonations: (donations.results || []).map(function(d) { return 'GHS ' + (d.amount || 0) + ' on ' + (d.created_at || ''); }),
      };

      var systemRec = 'You are a content recommendation engine. Recommend 3 specific pages from studio.gabochie.com based on user activity. Output JSON only.';
      var userRec = 'User profile: ' + JSON.stringify(profile) + '\n\nAvailable content: /school/ (programs), /books/ (books), /campaigns/1-million-systems-thinkers (campaign), /membership/ (membership), /support/ (support), /content/ (articles), /school/guitar/ (guitar course), /manifesto/ (manifesto)\nRespond with: { "recommendations": [{"page": "url", "reason": "why this fits"}] }';

      var recResult = await callAI(env, systemRec, userRec, { model: 'gpt-4o-mini', temperature: 0.3, max_tokens: 800 });

      var recs = {};
      try { recs = JSON.parse(recResult.content); } catch (_e) { recs = { recommendations: [] }; }

      return new Response(JSON.stringify({ status: 'ok', profile: profile, recommendations: recs.recommendations || [] }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
}
