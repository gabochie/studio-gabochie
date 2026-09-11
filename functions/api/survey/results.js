export async function onRequest(context) {
  var db = context.env.DB;
  if (!db) {
    return json({ error: 'D1 not bound' }, 501);
  }
  try {
    var url = new URL(context.request.url);
    var limit = Math.min(parseInt(url.searchParams.get('limit')) || 100, 500);
    var offset = parseInt(url.searchParams.get('offset')) || 0;
    var all = url.searchParams.get('all') === '1';
    var isAdmin = context.request.headers.get('CF-Access-Authenticated-User-Email') ||
                  context.request.headers.get('X-Admin-Auth');
    if (!isAdmin) {
      return json({ error: 'Unauthorized' }, 401);
    }
    var rows = await db.prepare(
      'SELECT id, name, email, phone, interests, other_text, created_at FROM survey_responses ORDER BY id DESC LIMIT ? OFFSET ?'
    ).bind(limit, offset).all();
    var total = await db.prepare('SELECT COUNT(*) as count FROM survey_responses').first();
    var parsed = rows.results.map(function(r) {
      try { r.interests = JSON.parse(r.interests); } catch (_e) { r.interests = []; }
      return r;
    });
    var counts = {};
    for (var i = 0; i < parsed.length; i++) {
      var list = parsed[i].interests;
      if (Array.isArray(list)) {
        for (var j = 0; j < list.length; j++) {
          counts[list[j]] = (counts[list[j]] || 0) + 1;
        }
      }
    }
    var totalCounts = {};
    if (all) {
      var allRows = await db.prepare('SELECT interests FROM survey_responses').all();
      for (var k = 0; k < allRows.results.length; k++) {
        var allList;
        try { allList = JSON.parse(allRows.results[k].interests); } catch (_e) { allList = []; }
        if (Array.isArray(allList)) {
          for (var m = 0; m < allList.length; m++) {
            totalCounts[allList[m]] = (totalCounts[allList[m]] || 0) + 1;
          }
        }
      }
    }
    return json({
      status: 'ok',
      total: total.count,
      responses: parsed,
      counts: all ? totalCounts : counts,
      pagination: { limit: limit, offset: offset }
    });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
