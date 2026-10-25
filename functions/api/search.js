import { checkRateLimit } from './_rate-limit.js';

const TYPES = ['article', 'book', 'course', 'listing'];
const LIMITS = { article: 20, book: 10, course: 20, listing: 15 };

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: Object.assign({
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store'
    }, headers || {})
  });
}

function cleanTerm(value) {
  var out = '';
  var raw = String(value == null ? '' : value);
  for (var i = 0; i < raw.length; i++) {
    var code = raw.charCodeAt(i);
    if (code < 32 || code === 127) {
      out += ' ';
    } else {
      out += raw.charAt(i);
    }
  }
  return out.replace(/\s+/g, ' ').trim();
}

function likeTerm(q) {
  return '%' + q.replace(/[%_]/g, function (ch) { return '\\' + ch; }) + '%';
}

function excerpt(text, max) {
  max = max || 180;
  var clean = cleanTerm(text);
  if (clean.length <= max) return clean;
  var cut = clean.slice(0, max);
  var space = cut.lastIndexOf(' ');
  if (space > max * 0.6) cut = cut.slice(0, space);
  return cut + '\u2026';
}

export async function onRequest(context) {
  var request = context.request;
  var env = context.env;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  if (request.method !== 'GET') {
    return json({ status: 'error', message: 'Method not allowed' }, 405);
  }

  if (!env || !env.DB) {
    return json({ status: 'error', message: 'Database not configured' }, 501);
  }

  var url = new URL(request.url);
  var query = cleanTerm(url.searchParams.get('q'));
  var typeParam = (url.searchParams.get('type') || 'all').toLowerCase();
  var limitParam = parseInt(url.searchParams.get('limit'), 10);
  var limit = isNaN(limitParam) ? 20 : Math.max(1, Math.min(50, limitParam));

  if (query.length < 2) {
    return json({ status: 'error', message: 'Query must be at least 2 characters' }, 400);
  }
  if (query.length > 120) {
    return json({ status: 'error', message: 'Query is too long' }, 400);
  }

  var types;
  if (typeParam === 'all') {
    types = TYPES.slice();
  } else if (TYPES.indexOf(typeParam) >= 0) {
    types = [typeParam];
  } else {
    return json({ status: 'error', message: 'Unknown search type' }, 400);
  }

  var ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  var allowed = await checkRateLimit(env.DB, ip, 'search', 60, 60);
  if (!allowed) {
    return json({ status: 'error', message: 'Too many requests' }, 429);
  }

  var needle = likeTerm(query);
  var expiry = new Date().toISOString().slice(0, 19).replace('T', ' ');

  var tasks = {
    article: function () {
      return env.DB.prepare(
        "SELECT slug, title, excerpt, cover_image, author, published_at FROM posts " +
        "WHERE status = 'published' AND (title LIKE ? OR excerpt LIKE ? OR COALESCE(tags, '') LIKE ?) " +
        "ORDER BY published_at DESC LIMIT ?"
      ).bind(needle, needle, needle, LIMITS.article).all();
    },
    book: function () {
      return env.DB.prepare(
        "SELECT id, slug, title, description, cover_image, price, price_label FROM books " +
        "WHERE (title LIKE ? OR description LIKE ?) " +
        "ORDER BY sort_order ASC LIMIT ?"
      ).bind(needle, needle, LIMITS.book).all();
    },
    course: function () {
      return env.DB.prepare(
        "SELECT id, title, slug, tagline, description, price, price_label FROM programs " +
        "WHERE status = 'active' AND (title LIKE ? OR tagline LIKE ? OR description LIKE ?) " +
        "ORDER BY sort_order ASC LIMIT ?"
      ).bind(needle, needle, needle, LIMITS.course).all();
    },
    listing: function () {
      return env.DB.prepare(
        "SELECT id, title, description, category, listing_type, price, location, featured, created_at FROM classifieds " +
        "WHERE status = 'approved' AND expires_at > ? AND (title LIKE ? OR description LIKE ? OR COALESCE(category, '') LIKE ?) " +
        "ORDER BY featured DESC, created_at DESC LIMIT ?"
      ).bind(expiry, needle, needle, needle, LIMITS.listing).all();
    }
  };

  var results = [];
  var counts = { article: 0, book: 0, course: 0, listing: 0 };

  await Promise.all(types.map(async function (type) {
    var outcome;
    try {
      outcome = await tasks[type]();
    } catch (_) {
      outcome = { results: [] };
    }
    var rows = (outcome && outcome.results) || [];
    counts[type] = rows.length;

    if (type === 'article') {
      rows.slice(0, LIMITS.article).forEach(function (row) {
        results.push({
          type: 'article',
          title: row.title || '',
          url: '/blog/' + row.slug + '/',
          excerpt: excerpt(row.excerpt),
          meta: { author: row.author || '', published_at: row.published_at || '' }
        });
      });
    } else if (type === 'book') {
      rows.slice(0, LIMITS.book).forEach(function (row) {
        results.push({
          type: 'book',
          title: row.title || '',
          url: '/books/' + row.slug + '/',
          excerpt: excerpt(row.description),
          meta: { price: row.price || 0, price_label: row.price_label || '' }
        });
      });
    } else if (type === 'course') {
      rows.slice(0, LIMITS.course).forEach(function (row) {
        results.push({
          type: 'course',
          title: row.title || '',
          url: '/courses/' + row.slug + '/',
          excerpt: excerpt(row.tagline || row.description),
          meta: { price: row.price || 0, price_label: row.price_label || '' }
        });
      });
    } else if (type === 'listing') {
      rows.slice(0, LIMITS.listing).forEach(function (row) {
        results.push({
          type: 'listing',
          title: row.title || '',
          url: '/careers/',
          excerpt: excerpt(row.description),
          meta: { category: row.category || '', location: row.location || '' }
        });
      });
    }
  }));

  var total = results.length;
  var sliced = results.slice(0, limit);

  return json({
    status: 'ok',
    query: query,
    type: typeParam,
    total: total,
    counts: counts,
    results: sliced
  });
}
