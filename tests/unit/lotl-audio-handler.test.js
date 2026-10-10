import { describe, it, expect } from 'vitest';
import { onRequest } from '../../functions/love-of-the-lord/audio/[[path]].js';

function booksEnv() {
  return {
    BOOKS: {
      head: async function () { return { size: 4 }; },
      get: async function (_key, opts) {
        if (opts && opts.range) {
          return { body: 'AB', size: opts.range.length };
        }
        return { body: 'ABCD', size: 4 };
      },
    },
    ASSETS: { fetch: async function () { return new Response('asset', { status: 200 }); } },
  };
}

function ctx(request, env, segments) {
  return { request: request, env: env, params: { path: segments } };
}

describe('LOTL audio streaming function', function () {
  it('streams a full mp3 with byte-range support advertised', async function () {
    const req = new Request('https://studio.gabochie.com/love-of-the-lord/audio/service-001.mp3');
    const res = await onRequest(ctx(req, booksEnv(), ['service-001.mp3']));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg');
    expect(res.headers.get('Accept-Ranges')).toBe('bytes');
    expect(res.headers.get('Content-Length')).toBe('4');
  });

  it('honours a Range request with 206 and Content-Range', async function () {
    const req = new Request('https://studio.gabochie.com/love-of-the-lord/audio/service-001.mp3', {
      headers: { Range: 'bytes=0-1' },
    });
    const res = await onRequest(ctx(req, booksEnv(), ['service-001.mp3']));
    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Range')).toBe('bytes 0-1/4');
    expect(res.headers.get('Content-Length')).toBe('2');
  });

  it('rejects an unsatisfiable range with 416', async function () {
    const req = new Request('https://studio.gabochie.com/love-of-the-lord/audio/service-001.mp3', {
      headers: { Range: 'bytes=9-10' },
    });
    const res = await onRequest(ctx(req, booksEnv(), ['service-001.mp3']));
    expect(res.status).toBe(416);
    expect(res.headers.get('Content-Range')).toBe('bytes */4');
  });

  it('only serves whitelisted audio extensions', async function () {
    const req = new Request('https://studio.gabochie.com/love-of-the-lord/audio/notes.txt');
    const res = await onRequest(ctx(req, booksEnv(), ['notes.txt']));
    expect(res.status).toBe(404);
  });

  it('blocks path traversal segments', async function () {
    const req = new Request('https://studio.gabochie.com/love-of-the-lord/audio/..%2Fsecret.mp3');
    const res = await onRequest(ctx(req, booksEnv(), ['..', 'secret.mp3']));
    expect(res.status).toBe(404);
  });

  it('falls back to static ASSETS when R2 is not bound', async function () {
    const req = new Request('https://studio.gabochie.com/love-of-the-lord/audio/service-001.mp3');
    const env = { ASSETS: { fetch: async function () { return new Response('asset', { status: 200 }); } } };
    const res = await onRequest(ctx(req, env, ['service-001.mp3']));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg');
  });

  it('404s when neither R2 nor ASSETS has the file', async function () {
    const req = new Request('https://studio.gabochie.com/love-of-the-lord/audio/missing.mp3');
    const env = {
      BOOKS: { get: async function () { return null; }, head: async function () { return null; } },
      ASSETS: { fetch: async function () { return new Response('nope', { status: 404 }); } },
    };
    const res = await onRequest(ctx(req, env, ['missing.mp3']));
    expect(res.status).toBe(404);
  });
});
