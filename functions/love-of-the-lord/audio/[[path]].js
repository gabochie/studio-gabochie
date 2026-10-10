// Love Of The Lord — audio streaming.
// Streams self-owned ministry audio (sermons, answers, bridges) from R2 under the
// `lotl/audio/` prefix, with HTTP Range support for seeking + offline caching.
// Falls back to the static ASSETS binding if R2 is not bound.
//
// Storage note: reuses the existing `gahq-books` bucket (binding BOOKS) under the
// `lotl/audio/` prefix to avoid extra infrastructure. If a dedicated bucket is
// created later, swap `env.BOOKS` for the new binding — the key prefix is unchanged.

const AUDIO_EXT = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
};

function notFound() {
  return new Response(JSON.stringify({ status: 'error', message: 'Audio not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}

function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header || '').trim());
  if (!m) return null;
  let start;
  let end;
  if (m[1] === '' && m[2] === '') return null;
  if (m[1] === '') {
    // suffix range: last N bytes
    const n = parseInt(m[2], 10);
    if (!n) return null;
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = parseInt(m[1], 10);
    end = m[2] === '' ? size - 1 : parseInt(m[2], 10);
  }
  if (start > end || start >= size) return null;
  end = Math.min(end, size - 1);
  return { offset: start, length: end - start + 1 };
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);

  const segments = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const rel = segments.join('/');
  const ext = (rel.split('.').pop() || '').toLowerCase();

  // Only serve whitelisted audio types, and block traversal.
  if (!AUDIO_EXT[ext] || rel.indexOf('..') !== -1 || rel.indexOf('//') !== -1) {
    return notFound();
  }

  const key = 'lotl/audio/' + rel;
  const contentType = AUDIO_EXT[ext];

  try {
    if (env.BOOKS && env.BOOKS.get) {
      const rangeHeader = request.headers.get('Range');
      if (rangeHeader) {
        const head = await env.BOOKS.head(key);
        if (head) {
          const range = parseRange(rangeHeader, head.size);
          if (!range) {
            return new Response(null, {
              status: 416,
              headers: { 'Content-Range': 'bytes */' + head.size },
            });
          }
          const obj = await env.BOOKS.get(key, { range });
          if (obj) {
            return new Response(obj.body, {
              status: 206,
              headers: {
                'Content-Type': contentType,
                'Content-Length': String(range.length),
                'Content-Range': 'bytes ' + range.offset + '-' + (range.offset + range.length - 1) + '/' + head.size,
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'public, max-age=86400',
              },
            });
          }
        }
      } else {
        const obj = await env.BOOKS.get(key);
        if (obj) {
          return new Response(obj.body, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Content-Length': String(obj.size),
              'Accept-Ranges': 'bytes',
              'Cache-Control': 'public, max-age=86400',
            },
          });
        }
      }
    }

    // Fallback: static asset of the same path (e.g. local dev / committed samples).
    const asset = await env.ASSETS.fetch(new Request(new URL(url.pathname, url.origin)));
    if (asset.ok) {
      const headers = new Headers(asset.headers);
      headers.set('Content-Type', contentType);
      headers.set('Accept-Ranges', 'bytes');
      return new Response(asset.body, { status: 200, headers });
    }
    return notFound();
  } catch (_err) {
    return notFound();
  }
}
