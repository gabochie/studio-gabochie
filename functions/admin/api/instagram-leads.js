import { requireAdmin } from '../_auth.js';

var CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key' };

export async function onRequest(context) {
  var { request, env } = context;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  var authError = await requireAdmin(request, env);
  if (authError) return authError;
  if (!env.DB) return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: { 'Content-Type': 'application/json', ...CORS } });

  try {
    var url = new URL(request.url);
    var action = url.searchParams.get('action') || '';

    // ── GET: list Instagram leads with filters ──
    if (request.method === 'GET') {
      var minFollowers = parseInt(url.searchParams.get('min_followers')) || 0;
      var maxFollowers = parseInt(url.searchParams.get('max_followers')) || 0;
      var bioKeyword = url.searchParams.get('bio_keyword') || '';
      var region = url.searchParams.get('region') || '';
      var status = url.searchParams.get('status') || '';
      var scrapeSource = url.searchParams.get('scrape_source') || '';
      var search = url.searchParams.get('search') || '';
      var scored = url.searchParams.get('scored') || '';
      var hasEmail = url.searchParams.get('has_email') || '';
      var sort = url.searchParams.get('sort') || 'imported_at';
      var sortDir = url.searchParams.get('sort_dir') || 'desc';
      var page = parseInt(url.searchParams.get('page')) || 1;
      var limit = Math.min(parseInt(url.searchParams.get('limit')) || 50, 500);
      var offset = (page - 1) * limit;

      var conds = ["co.source = 'instagram'"];
      var params = [];
      if (minFollowers > 0) { conds.push('co.follower_count >= ?'); params.push(minFollowers); }
      if (maxFollowers > 0) { conds.push('co.follower_count <= ?'); params.push(maxFollowers); }
      if (bioKeyword) { conds.push('LOWER(co.bio) LIKE ?'); params.push('%' + bioKeyword.toLowerCase() + '%'); }
      if (region) { conds.push('co.region = ?'); params.push(region); }
      if (status) { conds.push('co.status = ?'); params.push(status); }
      if (scrapeSource) { conds.push('co.scrape_source = ?'); params.push(scrapeSource); }
      if (search) { conds.push("(co.name LIKE ? OR co.instagram_username LIKE ? OR co.email LIKE ?)"); var s = '%' + search + '%'; params.push(s, s, s); }
      if (scored === 'yes') conds.push('co.score > 0');
      if (scored === 'no') conds.push('(co.score IS NULL OR co.score = 0)');
      if (hasEmail === 'yes') conds.push("co.email != ''");
      if (hasEmail === 'no') conds.push("(co.email IS NULL OR co.email = '')");
      var where = ' WHERE ' + conds.join(' AND ');

      var countResult = await env.DB.prepare("SELECT COUNT(*) as total FROM cold_outreach co" + where).bind(...params).first();
      var total = countResult ? countResult.total : 0;
      var orderBy = sort === 'score' ? 'co.score' : sort === 'follower_count' ? 'co.follower_count' : sort === 'name' ? 'co.name' : 'co.imported_at';
      var dir = sortDir === 'asc' ? 'ASC' : 'DESC';
      var results = await env.DB.prepare("SELECT co.* FROM cold_outreach co" + where + " ORDER BY " + orderBy + " " + dir + ", co.id DESC LIMIT ? OFFSET ?").bind(...params, limit, offset).all();

      // Stats
      var stats = await env.DB.prepare("SELECT status, COUNT(*) as c FROM cold_outreach WHERE source = 'instagram' GROUP BY status").all();
      var totalLeads = await env.DB.prepare("SELECT COUNT(*) as c FROM cold_outreach WHERE source = 'instagram'").first();
      var scoredLeads = await env.DB.prepare("SELECT COUNT(*) as c FROM cold_outreach WHERE source = 'instagram' AND score > 0").first();
      var newWeek = await env.DB.prepare("SELECT COUNT(*) as c FROM cold_outreach WHERE source = 'instagram' AND imported_at > datetime('now', '-7 days')").first();
      var avgFollowers = await env.DB.prepare("SELECT AVG(follower_count) as avg FROM cold_outreach WHERE source = 'instagram' AND follower_count > 0").first();
      var avgScore = await env.DB.prepare("SELECT AVG(score) as avg FROM cold_outreach WHERE source = 'instagram' AND score > 0").first();

      return new Response(JSON.stringify({
        status: 'ok', items: results.results || [], total, page, limit,
        pages: Math.ceil(total / limit),
        stats: stats.results || [],
        totals: { all: totalLeads?.c || 0, scored: scoredLeads?.c || 0, new_week: newWeek?.c || 0 },
        averages: { followers: Math.round(avgFollowers?.avg || 0), score: Math.round((avgScore?.avg || 0) * 100) / 100 }
      }), { headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    // ── POST: import leads from scraper or score leads ──
    if (request.method === 'POST') {
      if (action === 'score') {
        // AI-score leads by their bio
        var body = await request.json();
        var ids = body.ids || [];
        var allLeads = body.all || false;

        var rows;
        if (allLeads) {
          rows = await env.DB.prepare("SELECT id, name, bio, instagram_username FROM cold_outreach WHERE source = 'instagram' AND bio != '' AND (score IS NULL OR score = 0) LIMIT 50").all();
          rows = rows.results || [];
        } else if (ids.length) {
          var placeholders = ids.map(function() { return '?' }).join(',');
          rows = await env.DB.prepare("SELECT id, name, bio, instagram_username FROM cold_outreach WHERE id IN (" + placeholders + ")").bind(...ids).all();
          rows = rows.results || [];
        } else {
          return new Response(JSON.stringify({ status: 'error', message: 'Provide ids[] or all=true' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
        }

        var scored = [];
        for (var r of rows) {
          if (!r.bio) { scored.push({ id: r.id, score: 0, reason: 'No bio to score' }); continue; }
          try {
            var scoreResult = await scoreBio(env, r.bio, r.name || r.instagram_username);
            await env.DB.prepare("UPDATE cold_outreach SET score = ?, score_reason = ?, updated_at = datetime('now') WHERE id = ?").bind(scoreResult.score, scoreResult.reason, r.id).run();
            scored.push({ id: r.id, score: scoreResult.score, reason: scoreResult.reason });
          } catch (e) {
            scored.push({ id: r.id, score: 0, reason: 'Error: ' + e.message });
          }
        }

        return new Response(JSON.stringify({ status: 'ok', scored: scored.length, results: scored }), { headers: { 'Content-Type': 'application/json', ...CORS } });
      }

      // Bulk import from scraper output
      var importBody = await request.json();
      var leads = importBody.leads || [importBody];
      if (!leads.length) return new Response(JSON.stringify({ status: 'error', message: 'No leads provided' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
      var importCampaign = importBody.campaign || 'instagram-scrape';

      var imported = []; var errors = [];
      for (var i = 0; i < leads.length; i++) {
        var l = leads[i];
        if (!l.instagram_username && !l.name) { errors.push({ index: i, message: 'instagram_username or name required' }); continue; }
        try {
          // Check duplicate by instagram_username
          var existing = null;
          if (l.instagram_username) {
            existing = await env.DB.prepare("SELECT id FROM cold_outreach WHERE instagram_username = ? AND source = 'instagram'").bind(l.instagram_username).first();
          }
          if (existing) {
            // Update existing
            await env.DB.prepare(
              "UPDATE cold_outreach SET follower_count = ?, following_count = ?, bio = ?, profile_url = ?, is_verified = ?, email = CASE WHEN ? != '' AND ? IS NOT NULL THEN ? ELSE email END, phone = CASE WHEN ? != '' AND ? IS NOT NULL THEN ? ELSE phone END, region = CASE WHEN ? != '' THEN ? ELSE region END, notes = CASE WHEN ? != '' THEN ? ELSE notes END, last_scraped = datetime('now'), updated_at = datetime('now') WHERE id = ?"
            ).bind(
              l.follower_count || 0, l.following_count || 0, l.bio || '', l.profile_url || '', l.is_verified ? 1 : 0,
              l.email || '', l.email || '', l.email || '',
              l.phone || '', l.phone || '', l.phone || '',
              l.region || '', l.region || '',
              l.notes || '', l.notes || '',
              existing.id
            ).run();
            imported.push({ id: existing.id, updated: true, instagram_username: l.instagram_username });
          } else {
            // Insert new
            var result = await env.DB.prepare(
              "INSERT INTO cold_outreach (name, phone, email, website, region, country, source, campaign, notes, instagram_username, follower_count, following_count, bio, profile_url, is_verified, scrape_source) VALUES (?, ?, ?, ?, ?, ?, 'instagram', ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            ).bind(
              l.name || l.instagram_username || '', l.phone || '', l.email || '', l.website || '',
              l.region || '', l.country || 'Ghana', importCampaign,
              JSON.stringify({ instagram_scrape: { source: l.scrape_source || importBody.source || '', scraped_at: new Date().toISOString(), bio: l.bio || '', follower_count: l.follower_count || 0, is_verified: l.is_verified || false } }),
              l.instagram_username || '', l.follower_count || 0, l.following_count || 0,
              l.bio || '', l.profile_url || '', l.is_verified ? 1 : 0,
              l.scrape_source || ''
            ).run();
            var row = await env.DB.prepare("SELECT * FROM cold_outreach WHERE id = ?").bind(result.meta.last_row_id).first();
            imported.push(row);
          }
        } catch (e) {
          errors.push({ index: i, instagram_username: l.instagram_username, message: e.message });
        }
      }

      return new Response(JSON.stringify({
        status: 'ok', imported: imported.length, errors: errors.length, items: imported, errors_list: errors
      }), { headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    // ── PUT: update status or notes ──
    if (request.method === 'PUT') {
      var putBody = await request.json();
      var id = url.searchParams.get('id') || putBody.id;
      if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });

      var fields = []; var p = [];
      if (putBody.status !== undefined) { fields.push('status = ?'); p.push(putBody.status);
        if (putBody.status === 'contacted') fields.push("contacted_at = datetime('now')");
      }
      if (putBody.campaign !== undefined) { fields.push('campaign = ?'); p.push(putBody.campaign); }
      if (putBody.notes !== undefined) { fields.push('notes = ?'); p.push(putBody.notes); }
      if (putBody.score !== undefined) { fields.push('score = ?'); p.push(putBody.score); }
      if (putBody.score_reason !== undefined) { fields.push('score_reason = ?'); p.push(putBody.score_reason); }
      if (putBody.region !== undefined) { fields.push('region = ?'); p.push(putBody.region); }
      if (!fields.length) return new Response(JSON.stringify({ error: 'No fields to update' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
      fields.push("updated_at = datetime('now')");
      p.push(id);
      await env.DB.prepare("UPDATE cold_outreach SET " + fields.join(', ') + " WHERE id = ?").bind(...p).run();
      var updated = await env.DB.prepare("SELECT * FROM cold_outreach WHERE id = ?").bind(id).first();
      return new Response(JSON.stringify({ status: 'ok', item: updated }), { headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    // ── DELETE ──
    if (request.method === 'DELETE') {
      var delId = url.searchParams.get('id');
      if (!delId) return new Response(JSON.stringify({ error: 'id required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
      await env.DB.prepare("DELETE FROM cold_outreach WHERE id = ? AND source = 'instagram'").bind(delId).run();
      return new Response(JSON.stringify({ status: 'ok', deleted: delId }), { headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...CORS } });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
  }
}

async function scoreBio(env, bio, name) {
  var systemPrompt = 'You are a lead scoring AI. Rate this Instagram profile bio on a scale of 0-100 for how likely the person would benefit from or be interested in career development, personal growth, and educational opportunities targeting Ghanaian youth aged 15-35. Give higher scores to bios that mention: Ghana, Accra, Kumasi, entrepreneurship, tech, student, university, job seeker, developer, creative, freelancer, business. Give medium scores to general youth-oriented bios. Give low scores to bios that are empty, spammy, in non-English languages, or clearly irrelevant. Return only a JSON object with "score" (number 0-100) and "reason" (short string).';

  var userPrompt = 'Name: ' + (name || 'Unknown') + '\nBio: ' + (bio || 'No bio');

  try {
    var aiUrl = env.OPENAI_ENDPOINT || 'https://api.openai.com/v1/chat/completions';
    var aiKey = env.OPENAI_API_KEY || env.OPENROUTER_API_KEY || '';
    if (!aiKey) return { score: 0, reason: 'No AI key configured' };

    var aiRes = await fetch(aiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + aiKey },
      body: JSON.stringify({
        model: env.AI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 100,
        response_format: { type: 'json_object' }
      })
    });
    var aiData = await aiRes.json();
    var content = aiData.choices?.[0]?.message?.content || '{}';
    var result = JSON.parse(content);
    return { score: Math.min(100, Math.max(0, parseInt(result.score) || 0)), reason: (result.reason || '').substring(0, 200) };
  } catch (e) {
    return { score: 0, reason: 'AI error: ' + e.message };
  }
}
