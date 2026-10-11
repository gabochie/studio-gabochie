import { describe, it, expect } from 'vitest';
import { mockDb, buildContext } from '../helpers/mock-cf.js';

import { onRequest as bankCreate } from '../../functions/api/gateways/bank/create.js';

function post(url, body, env) {
  return buildContext(url, {
    method: 'POST',
    env: env,
    request: new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  });
}

describe('bank transfer gateway', function () {
  it('stages a pending donation with account details', async function () {
    var db = mockDb({ donations: [] });
    var ctx = post('http://localhost/api/gateways/bank/create',
      { amount: 200, name: 'Bea', email: 'bea@t.co' },
      { DB: db, BANK_NAME: 'GTBank', BANK_ACCOUNT_NAME: 'Studio Gabochie', BANK_ACCOUNT_NUMBER: '1234567890', BANK_BRANCH: 'Accra' });
    var res = await bankCreate(ctx);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.configured).toBe(true);
    expect(data.tx_ref).toMatch(/^bank_/);
    expect(data.account_number).toBe('1234567890');
    expect(db._tables.donations).toHaveLength(1);
    expect(db._tables.donations[0].provider).toBe('bank');
    expect(db._tables.donations[0].status).toBe('pending');
  });

  it('guides to email when bank details are not configured', async function () {
    var db = mockDb({ donations: [] });
    var ctx = post('http://localhost/api/gateways/bank/create',
      { amount: 200, name: 'Bea', email: 'bea@t.co' }, { DB: db });
    var data = await (await bankCreate(ctx)).json();
    expect(data.status).toBe('ok');
    expect(data.configured).toBe(false);
  });

  it('rejects bad amounts and emails', async function () {
    var db = mockDb({ donations: [] });
    var r1 = await bankCreate(post('http://localhost/x', { amount: 0, name: 'B', email: 'b@t.co' }, { DB: db }));
    expect(r1.status).toBe(400);
    var r2 = await bankCreate(post('http://localhost/x', { amount: 50, name: 'B', email: 'nope' }, { DB: db }));
    expect(r2.status).toBe(400);
  });
});
