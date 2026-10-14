// GET /api/fearless/stream?token=...&part=sample|intro|ch01..ch07
// Validates the token, then streams the MP3 from R2 (gahq-books, fearless-steps/audio/).
// Supports Range requests so phones can seek. No token listing, no download headers.
var PARTS = {
  sample: 'fearless-steps/audio/sample.mp3',
  intro: 'fearless-steps/audio/intro.mp3',
  ch01: 'fearless-steps/audio/ch01.mp3',
  ch02: 'fearless-steps/audio/ch02.mp3',
  ch03: 'fearless-steps/audio/ch03.mp3',
  ch04: 'fearless-steps/audio/ch04.mp3',
  ch05: 'fearless-steps/audio/ch05.mp3',
  ch06: 'fearless-steps/audio/ch06.mp3',
  ch07: 'fearless-steps/audio/ch07.mp3'
};

function parseRange(header, size) {
  var m = /^bytes=(\d*)-(\d*)$/.exec(header || '');
  if (!m) return null;
  var start = m[1] === '' ? Math.max(0, size - parseInt(m[2], 10)) : parseInt(m[1], 10);
  var end = m[2] === '' ? size - 1 : parseInt(m[2], 10);
  if (isNaN(start) || isNaN(end) || start > end || start >= size) return null;
  return { offset: start, length: Math.min(end, size - 1) - start + 1, end: Math.min(end, size - 1) };
}

export async function onRequest(context) {
  var req = context.request, env = context.env;
  var url = new URL(req.url);
  var token = url.searchParams.get('token') || '';
  var part = url.searchParams.get('part') || '';
  if (!PARTS[part]) {
    return new Response(JSON.stringify({ error: 'Unknown part' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  // Free sample streams without a token; full chapters require one.
  if (part !== 'sample') {
    if (!env.DB) {
      return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: { 'Content-Type': 'application/json' } });
    }
    var row = await env.DB.prepare(
      "SELECT token FROM fearless_tokens WHERE token = ? AND expires_at > datetime('now')"
    ).bind(token).first();
    if (!row) {
      return new Response(JSON.stringify({ error: 'Unlock required — enter your printed code.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }
  }
  if (!env.BOOKS || !env.BOOKS.get) {
    return new Response(JSON.stringify({ error: 'Audio storage not bound yet — upload MP3s to R2 gahq-books/fearless-steps/audio/' }), { status: 501, headers: { 'Content-Type': 'application/json' } });
  }
  var key = PARTS[part];
  var range = parseRange(req.headers.get('Range'), 0);
  var obj;
  if (range) {
    // size unknown until first fetch; fetch head via full get if needed
    var probe = await env.BOOKS.head(key);
    if (!probe) {
      return new Response(JSON.stringify({ error: 'Audio not uploaded yet' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }
    range = parseRange(req.headers.get('Range'), probe.size);
    if (!range) {
      return new Response('Range not satisfiable', { status: 416 });
    }
    obj = await env.BOOKS.get(key, { range: { offset: range.offset, length: range.length } });
    if (!obj) {
      return new Response(JSON.stringify({ error: 'Audio not uploaded yet' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(obj.body, {
      status: 206,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Range': 'bytes ' + range.offset + '-' + range.end + '/' + probe.size,
        'Content-Length': String(range.length),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=3600'
      }
    });
  }
  obj = await env.BOOKS.get(key);
  if (!obj) {
    return new Response(JSON.stringify({ error: 'Audio not uploaded yet' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  }
  return new Response(obj.body, {
    status: 200,
    headers: { 'Content-Type': 'audio/mpeg', 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=3600' }
  });
}
