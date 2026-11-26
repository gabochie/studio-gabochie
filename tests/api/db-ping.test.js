import { describe, it, expect } from 'vitest';
import { onRequest } from '../../functions/api/db/ping.js';

describe('DB ping', function () {
  it('reports a connected D1 binding', async function () {
    const DB = { prepare: () => ({ first: async () => ({ ok: 1 }) }) };
    const res = await onRequest({ env: { DB } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', d1: 'connected', db: 1 });
  });

  it('fails when D1 is not bound', async function () {
    const res = await onRequest({ env: {} });
    expect(res.status).toBe(501);
    expect((await res.json()).message).toBe('D1 not bound');
  });
});
