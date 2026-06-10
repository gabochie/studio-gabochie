export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!env.DB) return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });

  var SITE_URL = 'https://gideonabochie.org';
  var MAX_PAGES = 50;

  try {
    var body = request.method === 'POST' ? await request.json().catch(function() { return {}; }) : {};
    var trigger = body.trigger || 'manual';

    // Create run
    var runResult = await env.DB.prepare(
      "INSERT INTO quality_runs (trigger, status, started_at) VALUES (?, 'in_progress', datetime('now'))"
    ).bind(trigger).run();
    var runId = runResult.meta.last_row_id;

    // Fetch sitemap
    var sitemapRes = await fetch(SITE_URL + '/sitemap.xml');
    if (!sitemapRes.ok) {
      await env.DB.prepare("UPDATE quality_runs SET status = 'failed', completed_at = datetime('now') WHERE id = ?").bind(runId).run();
      return new Response(JSON.stringify({ status: 'error', message: 'Failed to fetch sitemap', run_id: runId }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }
    var sitemapText = await sitemapRes.text();
    var urls = [];
    var locRegex = /<loc>([^<]+)<\/loc>/g;
    var match;
    while ((match = locRegex.exec(sitemapText)) !== null) {
      urls.push(match[1]);
    }
    if (urls.length === 0) {
      await env.DB.prepare("UPDATE quality_runs SET status = 'failed', completed_at = datetime('now') WHERE id = ?").bind(runId).run();
      return new Response(JSON.stringify({ status: 'error', message: 'No URLs found in sitemap', run_id: runId }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    // Limit pages
    var pagesToScan = urls.slice(0, MAX_PAGES);
    var allReports = [];

    for (var i = 0; i < pagesToScan.length; i++) {
      var pageUrl = pagesToScan[i];
      try {
        var pageRes = await fetch(pageUrl, { signal: AbortSignal.timeout(8000) });
        var html = await pageRes.text();
        var statusCode = pageRes.status;
        var headers = {};
        pageRes.headers.forEach(function(v, k) { headers[k] = v; });

        // ── HTML checks ──
        checkHtml(html, pageUrl, runId, allReports);
        // ── SEO checks ──
        checkSeo(html, pageUrl, runId, allReports);
        // ── Security checks ──
        checkSecurity(headers, pageUrl, runId, allReports);
        // ── Performance checks ──
        checkPerformance(html, headers, pageUrl, runId, allReports);
        // ── Link check (basic: page returns 200) ──
        if (statusCode >= 400) {
          allReports.push({ run_id: runId, category: 'links', page_url: pageUrl, check_name: 'page_status', status: 'fail', message: 'Page returned HTTP ' + statusCode });
        } else {
          allReports.push({ run_id: runId, category: 'links', page_url: pageUrl, check_name: 'page_status', status: 'pass', message: 'HTTP ' + statusCode });
        }
      } catch (fetchErr) {
        allReports.push({ run_id: runId, category: 'links', page_url: pageUrl, check_name: 'page_fetch', status: 'fail', message: 'Fetch failed: ' + fetchErr.message });
      }
    }

    // Batch insert reports
    var passed = 0, failed = 0, warn = 0;
    for (var r = 0; r < allReports.length; r++) {
      var rep = allReports[r];
      if (rep.status === 'pass') passed++;
      else if (rep.status === 'fail') failed++;
      else warn++;
      try {
        await env.DB.prepare(
          'INSERT INTO quality_reports (run_id, category, page_url, check_name, status, message, details) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(rep.run_id, rep.category, rep.page_url, rep.check_name, rep.status, rep.message, '{}').run();
      } catch (e) {
        console.error('Failed to insert report:', e.message);
      }
    }

    // Update run
    await env.DB.prepare(
      "UPDATE quality_runs SET status = 'completed', total_checks = ?, passed_checks = ?, failed_checks = ?, warn_checks = ?, completed_at = datetime('now') WHERE id = ?"
    ).bind(allReports.length, passed, failed, warn, runId).run();

    return new Response(JSON.stringify({
      status: 'ok',
      run_id: runId,
      pages_scanned: pagesToScan.length,
      total_checks: allReports.length,
      passed: passed,
      failed: failed,
      warn: warn
    }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });

  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  }
}

function checkHtml(html, pageUrl, runId, reports) {
  var base = { run_id: runId, page_url: pageUrl };

  // Doctype
  if (/<!DOCTYPE html>/i.test(html)) {
    reports.push(Object.assign({}, base, { category: 'html', check_name: 'doctype', status: 'pass', message: 'HTML5 doctype present' }));
  } else {
    reports.push(Object.assign({}, base, { category: 'html', check_name: 'doctype', status: 'fail', message: 'Missing or invalid DOCTYPE html' }));
  }

  // Charset
  if (/<meta[^>]+charset\s*=\s*["']?utf-8["'^\s>]/i.test(html)) {
    reports.push(Object.assign({}, base, { category: 'html', check_name: 'charset', status: 'pass', message: 'UTF-8 charset declared' }));
  } else {
    reports.push(Object.assign({}, base, { category: 'html', check_name: 'charset', status: 'fail', message: 'Missing charset=UTF-8 declaration' }));
  }

  // Viewport
  if (/<meta[^>]+name\s*=\s*["']viewport["']/i.test(html)) {
    reports.push(Object.assign({}, base, { category: 'html', check_name: 'viewport', status: 'pass', message: 'Viewport meta tag present' }));
  } else {
    reports.push(Object.assign({}, base, { category: 'html', check_name: 'viewport', status: 'fail', message: 'Missing viewport meta tag' }));
  }

  // HTML lang
  if (/<html[^>]+lang\s*=/i.test(html)) {
    reports.push(Object.assign({}, base, { category: 'html', check_name: 'html_lang', status: 'pass', message: 'HTML lang attribute set' }));
  } else {
    reports.push(Object.assign({}, base, { category: 'html', check_name: 'html_lang', status: 'fail', message: 'Missing lang attribute on <html>' }));
  }
}

function checkSeo(html, pageUrl, runId, reports) {
  var base = { run_id: runId, page_url: pageUrl };

  // Meta description
  var descMatch = html.match(/<meta[^>]+name\s*=\s*["']description["'][^>]+content\s*=\s*["']([^"']*)["']/i);
  if (descMatch && descMatch[1].trim().length > 0) {
    reports.push(Object.assign({}, base, { category: 'seo', check_name: 'meta_description', status: 'pass', message: 'Meta description present (' + descMatch[1].length + ' chars)' }));
  } else {
    reports.push(Object.assign({}, base, { category: 'seo', check_name: 'meta_description', status: 'fail', message: 'Missing or empty meta description' }));
  }

  // Title
  var titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  if (titleMatch && titleMatch[1].trim().length > 0) {
    reports.push(Object.assign({}, base, { category: 'seo', check_name: 'page_title', status: 'pass', message: 'Page title present (' + titleMatch[1].length + ' chars)' }));
  } else {
    reports.push(Object.assign({}, base, { category: 'seo', check_name: 'page_title', status: 'fail', message: 'Missing or empty page title' }));
  }

  // Open Graph
  if (/<meta[^>]+property\s*=\s*["']og:title["']/i.test(html) && /<meta[^>]+property\s*=\s*["']og:description["']/i.test(html)) {
    reports.push(Object.assign({}, base, { category: 'seo', check_name: 'open_graph', status: 'pass', message: 'OG title and description present' }));
  } else {
    reports.push(Object.assign({}, base, { category: 'seo', check_name: 'open_graph', status: 'warn', message: 'Missing OG tags (title or description)' }));
  }

  // Canonical
  if (/<link[^>]+rel\s*=\s*["']canonical["']/i.test(html)) {
    reports.push(Object.assign({}, base, { category: 'seo', check_name: 'canonical', status: 'pass', message: 'Canonical link present' }));
  } else {
    reports.push(Object.assign({}, base, { category: 'seo', check_name: 'canonical', status: 'warn', message: 'Missing canonical link' }));
  }
}

function checkSecurity(headers, pageUrl, runId, reports) {
  var base = { run_id: runId, page_url: pageUrl };

  if (headers['content-security-policy']) {
    reports.push(Object.assign({}, base, { category: 'security', check_name: 'csp', status: 'pass', message: 'Content-Security-Policy header set' }));
  } else {
    reports.push(Object.assign({}, base, { category: 'security', check_name: 'csp', status: 'warn', message: 'Missing CSP header (may be inherited from _headers)' }));
  }

  if (headers['strict-transport-security']) {
    reports.push(Object.assign({}, base, { category: 'security', check_name: 'hsts', status: 'pass', message: 'HSTS header set' }));
  } else {
    reports.push(Object.assign({}, base, { category: 'security', check_name: 'hsts', status: 'warn', message: 'Missing HSTS header' }));
  }

  if (headers['x-content-type-options']) {
    reports.push(Object.assign({}, base, { category: 'security', check_name: 'x_content_type', status: 'pass', message: 'X-Content-Type-Options header set' }));
  } else {
    reports.push(Object.assign({}, base, { category: 'security', check_name: 'x_content_type', status: 'warn', message: 'Missing X-Content-Type-Options header' }));
  }

  // Check frame-ancestors in CSP or X-Frame-Options
  var xfo = headers['x-frame-options'];
  var csp = headers['content-security-policy'] || '';
  if (xfo || /frame-ancestors/i.test(csp)) {
    reports.push(Object.assign({}, base, { category: 'security', check_name: 'clickjack_protection', status: 'pass', message: 'Clickjacking protection present' }));
  } else {
    reports.push(Object.assign({}, base, { category: 'security', check_name: 'clickjack_protection', status: 'warn', message: 'No X-Frame-Options or CSP frame-ancestors' }));
  }
}

function checkPerformance(html, headers, pageUrl, runId, reports) {
  var base = { run_id: runId, page_url: pageUrl };

  // Font preconnect
  var preconnects = html.match(/<link[^>]+rel\s*=\s*["']preconnect["'][^>]*>/gi);
  var preconnectCount = preconnects ? preconnects.length : 0;
  if (preconnectCount > 0) {
    reports.push(Object.assign({}, base, { category: 'performance', check_name: 'font_preconnect', status: 'pass', message: preconnectCount + ' preconnect link(s) found' }));
  } else {
    reports.push(Object.assign({}, base, { category: 'performance', check_name: 'font_preconnect', status: 'warn', message: 'No preconnect links for fonts' }));
  }

  // Page size estimate
  var sizeKB = Math.round(new Blob([html]).size / 1024);
  if (sizeKB < 200) {
    reports.push(Object.assign({}, base, { category: 'performance', check_name: 'page_size', status: 'pass', message: 'Page size ~' + sizeKB + 'KB' }));
  } else {
    reports.push(Object.assign({}, base, { category: 'performance', check_name: 'page_size', status: 'warn', message: 'Page size ~' + sizeKB + 'KB (consider optimization)' }));
  }
}
