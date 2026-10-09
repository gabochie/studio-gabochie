import { describe, it, expect } from 'vitest';
import { mockDb, buildContext } from '../helpers/mock-cf.js';

import { onRequest as storeDownload } from '../../functions/api/store/download.js';
import { onRequest as booksDownload } from '../../functions/api/books/download.js';
import { onRequest as booking } from '../../functions/api/booking.js';

function get(url, env) {
  return buildContext(url, { method: 'GET', env: env, request: new Request(url) });
}

function postForm(url, fields, env) {
  var parts = [];
  for (var key in fields) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(fields[key])));
    }
  }
  return buildContext(url, {
    method: 'POST',
    env: env,
    request: new Request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: parts.join('&')
    })
  });
}

describe('download gates (phase 1)', function () {
  it('store: serves a completed order by tx_ref', async function () {
    var db = mockDb({ store_orders: [
      { id: 1, tx_ref: 'store_abc', item_name: 'Tee', status: 'completed', customer_email: 'a@t.co' }
    ] });
    var res = await storeDownload(get('http://localhost/api/store/download?tx_ref=store_abc', { DB: db }));
    expect(res.status).toBe(200);
    expect((await res.json()).order.tx_ref).toBe('store_abc');
  });

  it('store: rejects bare user_id enumeration without a session', async function () {
    var db = mockDb({ store_orders: [
      { id: 1, user_id: 9, tx_ref: 'store_vic', item_name: 'Tee', status: 'completed' }
    ] });
    var res = await storeDownload(get('http://localhost/api/store/download?user_id=9', { DB: db }));
    expect(res.status).toBe(401);
  });

  it('store: scopes library orders to the session owner', async function () {
    var db = mockDb({
      store_orders: [
        { id: 1, user_id: 7, tx_ref: 'store_mine', item_name: 'Tee', status: 'completed' },
        { id: 2, user_id: 9, tx_ref: 'store_theirs', item_name: 'Cap', status: 'completed' }
      ],
      sessions: [{ token: 'tok-7', user_id: 7, email: 'me@t.co', name: 'Me', membership_tier: 'free' }]
    });
    var res = await storeDownload(get('http://localhost/api/store/download?token=tok-7', { DB: db }));
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.orders).toHaveLength(1);
    expect(data.orders[0].tx_ref).toBe('store_mine');
  });

  it('store: email lookup is gone', async function () {
    var db = mockDb({ store_orders: [
      { id: 1, customer_email: 'a@t.co', tx_ref: 'store_e', status: 'completed' }
    ] });
    var res = await storeDownload(get('http://localhost/api/store/download?email=a@t.co', { DB: db }));
    expect(res.status).toBe(401);
  });

  it('books: serves by tx_ref, rejects email lookup', async function () {
    var db = mockDb({ book_purchases: [
      { id: 1, tx_ref: 'books_x', email: 'a@t.co', status: 'completed', downloaded: 0 }
    ], books: [] });
    var ok = await booksDownload(get('http://localhost/api/books/download?tx_ref=books_x', { DB: db }));
    expect(ok.status).toBe(200);
    var noEmail = await booksDownload(get('http://localhost/api/books/download?email=a@t.co', { DB: db }));
    expect(noEmail.status).toBe(400);
    var noRef = await booksDownload(get('http://localhost/api/books/download', { DB: db }));
    expect(noRef.status).toBe(400);
  });
});

describe('booking stays pending (phase 1)', function () {
  it('never marks paid from a client-supplied tx_ref', async function () {
    var db = mockDb({ bookings: [], contact_submissions: [], email_queue: [] });
    var ctx = postForm('http://localhost/api/booking',
      { name: 'Ann', email: 'ann@t.co', slot: 'standard', tx_ref: 'fake_ref', amount: '500' }, { DB: db });
    var res = await booking(ctx);
    expect(res.status).toBe(200);
    expect(db._tables.bookings).toHaveLength(1);
    expect(db._tables.bookings[0].status).toBe('pending');
    expect(db._tables.bookings[0].payment_tx_ref).toBe('fake_ref');
  });
});
