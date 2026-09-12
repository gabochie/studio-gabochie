import { describe, it, expect, beforeEach } from 'vitest';
import { mockDb, mockAssets, buildContext } from '../helpers/mock-cf.js';

// Import the actual endpoint
import { onRequest } from '../../functions/api/books/serve.js';

var freeBook = {
  slug: 'the-bible-as-kingdom-os',
  title: 'The Bible as Kingdom OS',
  file_url: '/books/the-bible-as-kingdom-os.pdf',
  is_premium: 0,
};

var premiumBundle = {
  slug: 'premium-bundle',
  title: 'Premium Bundle',
  file_url: '/books/premium-bundle.html',
  is_premium: 1,
};

var subscriber = { email: 'reader@test.com' };
var member = { email: 'member@test.com', membership_tier: 'free' };
var completedPurchase = { tx_ref: 'tx-valid', email: 'buyer@test.com', status: 'completed' };
var pendingPurchase = { tx_ref: 'tx-pending', email: 'buyer@test.com', status: 'pending' };

describe('GET /api/books/serve', function () {
  var ctx;

  beforeEach(function () {
    ctx = buildContext('http://localhost/api/books/serve', {
      env: {
        DB: mockDb({
          books: [freeBook, premiumBundle],
          subscribers: [subscriber],
          users: [member],
          book_purchases: [completedPurchase, pendingPurchase],
        }),
        ASSETS: mockAssets(new Response('pdf content here', {
          status: 200,
          headers: { 'Content-Type': 'application/pdf', 'Content-Length': '16' },
        })),
      },
    });
  });

  it('returns 400 when slug is missing', async function () {
    ctx.request = new Request('http://localhost/api/books/serve');
    var res = await onRequest(ctx);
    expect(res.status).toBe(400);
    var body = await res.json();
    expect(body.message).toContain('Missing slug');
  });

  it('returns 404 when slug does not match any book', async function () {
    ctx.request = new Request('http://localhost/api/books/serve?slug=nonexistent');
    var res = await onRequest(ctx);
    expect(res.status).toBe(404);
    var body = await res.json();
    expect(body.message).toBe('Book not found');
  });

  it('returns 404 when book has no file_url', async function () {
    ctx.env.DB = mockDb({
      books: [{ slug: 'empty', title: 'No File', file_url: null, is_premium: 0 }],
      subscribers: [],
      book_purchases: [],
    });
    ctx.request = new Request('http://localhost/api/books/serve?slug=empty');
    var res = await onRequest(ctx);
    expect(res.status).toBe(404);
  });

  describe('free books', function () {
    it('returns 403 HTML when no email is provided', async function () {
      ctx.request = new Request('http://localhost/api/books/serve?slug=the-bible-as-kingdom-os');
      var res = await onRequest(ctx);
      expect(res.status).toBe(403);
      var text = await res.text();
      expect(text).toContain('Access');
      expect(text).toContain('submit your email');
      expect(res.headers.get('Content-Type')).toContain('text/html');
    });

    it('returns 403 HTML when email is not in subscribers table', async function () {
      ctx.request = new Request('http://localhost/api/books/serve?slug=the-bible-as-kingdom-os&email=unknown@test.com');
      var res = await onRequest(ctx);
      expect(res.status).toBe(403);
    });

    it('returns 200 with file when email is in subscribers table', async function () {
      ctx.request = new Request('http://localhost/api/books/serve?slug=the-bible-as-kingdom-os&email=reader@test.com');
      var res = await onRequest(ctx);
      expect(res.status).toBe(200);
      var body = await res.text();
      expect(body).toBe('pdf content here');
    });

    it('returns 200 with file when email is a registered member (users table)', async function () {
      ctx.request = new Request('http://localhost/api/books/serve?slug=the-bible-as-kingdom-os&email=member@test.com');
      var res = await onRequest(ctx);
      expect(res.status).toBe(200);
      var body = await res.text();
      expect(body).toBe('pdf content here');
    });

    it('returns 403 when email is in neither subscribers nor users', async function () {
      ctx.request = new Request('http://localhost/api/books/serve?slug=the-bible-as-kingdom-os&email=nobody@test.com');
      var res = await onRequest(ctx);
      expect(res.status).toBe(403);
    });

    it('does not grant members access to premium books without a valid purchase', async function () {
      ctx.request = new Request('http://localhost/api/books/serve?slug=premium-bundle&email=member@test.com');
      var res = await onRequest(ctx);
      expect(res.status).toBe(403);
    });

    it('sets correct Content-Type for PDF', async function () {
      ctx.request = new Request('http://localhost/api/books/serve?slug=the-bible-as-kingdom-os&email=reader@test.com');
      var res = await onRequest(ctx);
      expect(res.headers.get('Content-Type')).toBe('application/pdf');
    });

    it('sets Content-Disposition for inline display', async function () {
      ctx.request = new Request('http://localhost/api/books/serve?slug=the-bible-as-kingdom-os&email=reader@test.com');
      var res = await onRequest(ctx);
      var disp = res.headers.get('Content-Disposition');
      expect(disp).toContain('inline');
      expect(disp).toContain('the-bible-as-kingdom-os.pdf');
    });

    it('sets X-Robots-Tag: noindex', async function () {
      ctx.request = new Request('http://localhost/api/books/serve?slug=the-bible-as-kingdom-os&email=reader@test.com');
      var res = await onRequest(ctx);
      expect(res.headers.get('X-Robots-Tag')).toBe('noindex');
    });

    it('serves DOCX with correct Content-Type', async function () {
      ctx.env.DB = mockDb({
        books: [{ slug: 'ai-national-development', title: 'AI Dev', file_url: '/books/ai-powered-strategic-national-development-ghana.docx', is_premium: 0 }],
        subscribers: [subscriber],
        book_purchases: [],
      });
      ctx.env.ASSETS = mockAssets(new Response('docx content', {
        status: 200,
        headers: { 'Content-Type': 'application/octet-stream' },
      }));
      ctx.request = new Request('http://localhost/api/books/serve?slug=ai-national-development&email=reader@test.com');
      var res = await onRequest(ctx);
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    });
  });

  describe('premium books', function () {
    it('returns 403 when no tx_ref is provided', async function () {
      ctx.request = new Request('http://localhost/api/books/serve?slug=premium-bundle');
      var res = await onRequest(ctx);
      expect(res.status).toBe(403);
      var text = await res.text();
      expect(text).toContain('requires a valid purchase');
    });

    it('returns 403 when email is provided but no tx_ref for premium', async function () {
      // Even registered subscriber email cannot bypass premium gating
      ctx.request = new Request('http://localhost/api/books/serve?slug=premium-bundle&email=reader@test.com');
      var res = await onRequest(ctx);
      expect(res.status).toBe(403);
    });

    it('returns 403 when tx_ref is not in completed purchases', async function () {
      ctx.request = new Request('http://localhost/api/books/serve?slug=premium-bundle&tx_ref=tx-invalid');
      var res = await onRequest(ctx);
      expect(res.status).toBe(403);
    });

    it('returns 403 when purchase is still pending', async function () {
      ctx.request = new Request('http://localhost/api/books/serve?slug=premium-bundle&tx_ref=tx-pending');
      var res = await onRequest(ctx);
      expect(res.status).toBe(403);
    });

    it('returns 200 with file when tx_ref matches a completed purchase', async function () {
      ctx.request = new Request('http://localhost/api/books/serve?slug=premium-bundle&tx_ref=tx-valid');
      var res = await onRequest(ctx);
      expect(res.status).toBe(200);
      var body = await res.text();
      expect(body).toBe('pdf content here');
    });

    it('serves premium HTML with text/html Content-Type', async function () {
      ctx.request = new Request('http://localhost/api/books/serve?slug=premium-bundle&tx_ref=tx-valid');
      var res = await onRequest(ctx);
      // premium-bundle.html — Node may append charset
      expect(res.headers.get('Content-Type')).toContain('text/html');
    });
  });

  describe('D1 binding missing', function () {
    it('returns 501 when env.DB is not bound', async function () {
      ctx.env.DB = undefined;
      ctx.request = new Request('http://localhost/api/books/serve?slug=test');
      var res = await onRequest(ctx);
      expect(res.status).toBe(501);
      var body = await res.json();
      expect(body.message).toContain('D1 not bound');
    });
  });

  describe('ASSETS fetch failure', function () {
    it('returns 404 when ASSETS cannot find the file', async function () {
      ctx.env.ASSETS = mockAssets(new Response('Not found', { status: 404 }));
      ctx.request = new Request('http://localhost/api/books/serve?slug=the-bible-as-kingdom-os&email=reader@test.com');
      var res = await onRequest(ctx);
      expect(res.status).toBe(404);
      var body = await res.json();
      expect(body.message).toContain('File not found');
    });
  });
});
