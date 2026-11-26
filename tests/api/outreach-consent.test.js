import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mockDb } from '../helpers/mock-cf.js';
import { onRequest as outreach } from '../../functions/api/ai/outreach.js';

var realFetch;
beforeEach(function () { realFetch = globalThis.fetch; });
afterEach(function () { globalThis.fetch = realFetch; });

function ctx(db) {
  var url = 'http://localhost/api/ai/outreach';
  return {
    request: new Request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': 'admin-key' },
      body: JSON.stringify({ segment: 'dormant', channel: 'both', subject: 'Hello' })
    }),
    env: {
      DB: db,
      ADMIN_API_KEY: 'admin-key',
      OPENAI_API_KEY: 'test-key',
      PUBLIC_BASE_URL: 'https://studio.gabochie.com'
    }
  };
}

describe('AI outreach consent filters', function () {
  it('skips suppressed addresses and non-opted-in WhatsApp recipients', async function () {
    globalThis.fetch = async function (url, opts) {
      if (String(url).includes('openai.com')) {
        return new Response(JSON.stringify({
          choices: [{ message: { content: 'SUBJECT: Hello\nBODY: Hi [name], come back.' } }],
          usage: {}
        }), { status: 200 });
      }
      return new Response(JSON.stringify({ messageId: 'm' }), { status: 200 });
    };
    var db = mockDb({
      events: [],
      rate_limits: [],
      suppression_list: [{ email: 'suppressed@example.com', reason: 'unsubscribe' }],
      subscribers: [
        { id: 1, email: 'happy@example.com', name: 'Happy', phone: '+233240000001', confirmed: 1, whatsapp_opt_in: 1, created_at: '2026-11-01 00:00:00' },
        { id: 2, email: 'suppressed@example.com', name: 'Suppressed', phone: '+233240000002', confirmed: 1, whatsapp_opt_in: 1, created_at: '2026-11-01 00:00:00' },
        { id: 3, email: 'noopt@example.com', name: 'No Opt', phone: '+233240000003', confirmed: 1, whatsapp_opt_in: 0, created_at: '2026-11-01 00:00:00' }
      ],
      email_queue: [],
      whatsapp_queue: []
    });
    var res = await outreach(ctx(db));
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    // Email consent is confirmed + not suppressed; WhatsApp additionally
    // requires an explicit opt-in, so noopt@example.com gets email only.
    expect(db._tables.email_queue.map(function (r) { return r.to_email; })).toEqual(['happy@example.com', 'noopt@example.com']);
    expect(db._tables.whatsapp_queue.map(function (r) { return r.to_phone; })).toEqual(['+233240000001']);
  });
});
