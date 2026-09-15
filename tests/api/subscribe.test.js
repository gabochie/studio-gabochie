import { describe, it, expect, beforeEach } from 'vitest';
import { mockDb, buildContext } from '../helpers/mock-cf.js';

import { onRequest } from '../../functions/api/subscribe.js';

function postJson(url, data) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

describe('POST /api/subscribe', function () {
  var ctx;

  beforeEach(function () {
    ctx = buildContext('http://localhost/api/subscribe', {
      env: {
        DB: mockDb({
          subscribers: [],
          events: [],
          referrals: [],
        }),
      },
    });
  });

  it('creates a start-page subscriber with UTM metadata', async function () {
    ctx.request = postJson('http://localhost/api/subscribe', {
      name: 'Ama',
      email: 'ama@example.com',
      source: 'start-page',
      utm_source: 'tiktok',
      utm_medium: 'bio',
      utm_campaign: 'launch',
    });
    var res = await onRequest(ctx);
    expect(res.status).toBe(200);
    var body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.confirmed).toBe(false);

    var rows = ctx.env.DB._tables.subscribers;
    expect(rows.length).toBe(1);
    expect(rows[0].source).toBe('start-page');
    var meta = JSON.parse(rows[0].metadata);
    expect(meta.utm_source).toBe('tiktok');
    expect(meta.utm_medium).toBe('bio');
    expect(meta.utm_campaign).toBe('launch');
    expect(rows[0].ref_code).toMatch(/^GA-/);
  });

  it('stores empty UTM fields cleanly when absent', async function () {
    ctx.request = postJson('http://localhost/api/subscribe', {
      email: 'kojo@example.com',
      source: 'homepage-bar',
    });
    var res = await onRequest(ctx);
    expect(res.status).toBe(200);
    var rows = ctx.env.DB._tables.subscribers;
    expect(rows.length).toBe(1);
    expect(rows[0].source).toBe('homepage-bar');
    var meta = JSON.parse(rows[0].metadata);
    expect(meta.utm_source).toBeUndefined();
  });

  it('rejects invalid email with 400', async function () {
    ctx.request = postJson('http://localhost/api/subscribe', {
      email: 'not-an-email',
      source: 'start-page',
    });
    var res = await onRequest(ctx);
    expect(res.status).toBe(400);
  });

  it('returns existing confirmed subscriber without duplicating', async function () {
    ctx.env.DB._tables.subscribers.push({
      id: 1, name: 'Yaw', email: 'yaw@example.com',
      source: 'start-page', ref_code: 'GA-ABC123',
      confirmed: 1, confirm_token: 'tok',
    });
    ctx.request = postJson('http://localhost/api/subscribe', {
      email: 'yaw@example.com',
      source: 'start-page',
    });
    var res = await onRequest(ctx);
    expect(res.status).toBe(200);
    var body = await res.json();
    expect(body.existing).toBe(true);
    expect(body.confirmed).toBe(true);
    expect(ctx.env.DB._tables.subscribers.length).toBe(1);
  });
});
