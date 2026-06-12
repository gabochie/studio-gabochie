import { callAI } from '../agents/_ai.js';
import { queueEmail, daysFromNow } from '../email/_send.js';

var corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };

var SEGMENTS = {
  active: { label: 'Active (last 30d)', sql: "SELECT DISTINCT email, name FROM subscribers WHERE email IN (SELECT email FROM events WHERE created_at >= datetime('now', '-30 days')) LIMIT 20" },
  dormant: { label: 'Dormant (31-90d)', sql: "SELECT DISTINCT s.email, s.name FROM subscribers s WHERE s.email NOT IN (SELECT email FROM events WHERE created_at >= datetime('now', '-30 days')) AND s.created_at >= datetime('now', '-90 days') LIMIT 20" },
  churned: { label: 'Churned (90d+)', sql: "SELECT DISTINCT s.email, s.name FROM subscribers s WHERE s.email NOT IN (SELECT email FROM events WHERE created_at >= datetime('now', '-90 days')) AND s.created_at <= datetime('now', '-90 days') LIMIT 20" },
  donors: { label: 'Donors', sql: "SELECT DISTINCT donor_email as email, donor_name as name FROM donations WHERE status = 'successful' AND created_at >= datetime('now', '-180 days') LIMIT 20" },
  students: { label: 'Students', sql: "SELECT DISTINCT email, name FROM students WHERE created_at >= datetime('now', '-180 days') LIMIT 20" },
};

export async function onRequest(context) {
  var { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  var url = new URL(request.url);
  var action = url.searchParams.get('action') || 'segments';

  try {
    if (request.method === 'GET' && action === 'segments') {
      // Return segment counts
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
      var body = await request.json();
      var segment = body.segment || 'dormant';
      var subject = body.subject || '';
      var preview = body.preview || false;

      if (!SEGMENTS[segment]) {
        return new Response(JSON.stringify({ error: 'Invalid segment' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }

      // Fetch users in this segment
      var usersResult = await env.DB.prepare(SEGMENTS[segment].sql).all();
      var users = usersResult.results || [];

      if (users.length === 0) {
        return new Response(JSON.stringify({ status: 'ok', message: 'No users in this segment', sent: 0 }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }

      // Generate email content via AI
      var segmentLabel = SEGMENTS[segment].label;
      var systemPrompt = 'You are an outreach specialist for GideonAbochie Studio — a Bible-based school of creativity, love, and wisdom. Write warm, personal re-engagement emails. Keep it under 150 words. Use simple HTML with inline styles.';
      var userPrompt = 'Write a re-engagement email for the segment: ' + segmentLabel + '. Subject line: ' + (subject || 'We miss you — GideonAbochie Studio') + '. The email should sound personal, remind them of the mission, and include a clear CTA to visit gideonabochie.org/school/. Wrap subject in SUBJECT: and body in BODY:.';

      var result = await callAI(env, systemPrompt, userPrompt, { model: 'gpt-4o-mini', temperature: 0.7, max_tokens: 800 });

      if (result.error) {
        return new Response(JSON.stringify({ error: result.error }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }

      var content = result.content || '';
      var subjectLine = subject || 'We miss you — GideonAbochie Studio';
      var bodyLines = content.split('BODY:');
      var emailBody = bodyLines.length > 1 ? bodyLines[1].trim() : content;

      // Extract subject from AI if not provided
      if (!subject && content.includes('SUBJECT:')) {
        var subMatch = content.match(/SUBJECT:\s*(.+)/);
        if (subMatch) subjectLine = subMatch[1].trim();
      }

      if (preview) {
        return new Response(JSON.stringify({ status: 'ok', preview: true, subject: subjectLine, body: emailBody, recipients: users.length, sampleUser: users[0] }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }

      // Queue emails
      var sent = 0;
      for (var i = 0; i < users.length; i++) {
        var user = users[i];
        var name = user.name || user.donor_name || '';
        var email = user.email || user.donor_email || '';
        if (!email) continue;

        var personalizedBody = emailBody.replace(/\[name\]/g, name || 'Friend').replace(/{name}/g, name || 'Friend');
        try {
          await queueEmail(env, email, name || 'Friend', subjectLine, personalizedBody, 'outreach_' + segment, daysFromNow(0));
          sent++;
        } catch (e) {
          // skip failed
        }
      }

      return new Response(JSON.stringify({ status: 'ok', message: 'Queued ' + sent + ' emails', segment: segment, subject: subjectLine, sent: sent }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // GET content recommendations for a user
    if (request.method === 'GET' && action === 'recommend') {
      var userEmail = url.searchParams.get('email') || '';
      if (!userEmail) {
        return new Response(JSON.stringify({ error: 'email param required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }

      // Get user's recent activity
      var events = await env.DB.prepare("SELECT event_type, page FROM events WHERE email = ? ORDER BY created_at DESC LIMIT 10").bind(userEmail).all();
      var donations = await env.DB.prepare("SELECT amount, created_at FROM donations WHERE donor_email = ? AND status = 'successful' ORDER BY created_at DESC LIMIT 5").bind(userEmail).all();

      var profile = {
        email: userEmail,
        recentEvents: (events.results || []).map(function(e) { return e.event_type + (e.page ? ' on ' + e.page : ''); }),
        recentDonations: (donations.results || []).map(function(d) { return 'GHS ' + (d.amount || 0) + ' on ' + (d.created_at || ''); }),
      };

      var systemPrompt = 'You are a content recommendation engine. Recommend 3 specific pages from gideonabochie.org based on user activity. Output JSON only.';
      var userPrompt = 'User profile: ' + JSON.stringify(profile) + '\n\nAvailable content: /school/ (programs), /books/ (books), /campaigns/1-million-systems-thinkers (campaign), /membership/ (membership), /support/ (support), /content/ (articles), /school/guitar/ (guitar course), /manifesto/ (manifesto)\n\nRespond with: { "recommendations": [{"page": "url", "reason": "why this fits"}] }';

      var result = await callAI(env, systemPrompt, userPrompt, { model: 'gpt-4o-mini', temperature: 0.3, max_tokens: 800 });

      var recs = {};
      try { recs = JSON.parse(result.content); } catch (e) { recs = { recommendations: [] }; }

      return new Response(JSON.stringify({ status: 'ok', profile: profile, recommendations: recs.recommendations || [] }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
}
