import { describe, it, expect } from 'vitest';
import { onRequest } from '../../functions/api/careers.js';
import { mockDb } from '../helpers/mock-cf.js';

function post(fields) {
  return new Request('https://studio.gabochie.com/api/careers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields)
  });
}

function submit(db, fields, env) {
  return onRequest({ request: post(fields), env: Object.assign({ DB: db }, env || {}) });
}

describe('POST /api/careers', function () {
  it('stores the structured remote-application fields', async function () {
    var db = mockDb();

    var res = await submit(db, {
      role_id: 'ops-revenue',
      name: 'Ama Mensah',
      email: 'ama@example.com',
      phone: '+233 24 000 0000',
      country: 'Ghana',
      timezone: 'GMT+0',
      availability_hours: '10',
      pay_expectation: 'GH¢1,500 / month',
      cv_url: 'https://example.com/ama.pdf',
      portfolio_url: 'https://example.com/work',
      cover_letter: 'I reconcile payments and review agent output.'
    });

    expect(res.status).toBe(201);
    var saved = (db._tables.career_applications || [])[0];
    expect(saved.role_id).toBe('ops-revenue');
    expect(saved.job_title).toContain('Operations');
    expect(saved.country).toBe('Ghana');
    expect(saved.timezone).toBe('GMT+0');
    expect(saved.availability_hours).toBe(10);
    expect(saved.pay_expectation).toBe('GH¢1,500 / month');
    expect(saved.cv_url).toContain('example.com');
    expect(saved.portfolio_url).toContain('example.com');
    expect(saved.source).toBe('careers-remote');
  });

  it('normalises unknown roles, unsafe URLs and out-of-range hours', async function () {
    var db = mockDb();

    var res = await submit(db, {
      role_id: 'not-a-role',
      name: 'Kofi',
      email: 'kofi@example.com',
      availability_hours: '999',
      cv_url: 'javascript:alert(1)',
      portfolio_url: 'data:text/html;base64,PHNjcmlwdD4=',
      cover_letter: 'x'.repeat(5000)
    });

    expect(res.status).toBe(201);
    var saved = (db._tables.career_applications || [])[0];
    expect(saved.role_id).toBe('general');
    expect(saved.job_title).toBe('General application');
    expect(saved.availability_hours).toBe(0);
    expect(saved.cv_url).toBe('');
    expect(saved.portfolio_url).toBe('');
    expect(saved.cover_letter.length).toBe(4000);
  });

  it('requires a name and email', async function () {
    var res = await submit(mockDb(), { role_id: 'design' });
    expect(res.status).toBe(400);
  });

  it('rejects a missing Turnstile token when the secret is configured', async function () {
    var res = await submit(mockDb(), { name: 'Bot', email: 'bot@example.com' }, { TURNSTILE_SECRET: 'secret' });
    expect(res.status).toBe(403);
  });

  it('keeps application detail when the database has not been migrated yet', async function () {
    var db = mockDb();
    var realPrepare = db.prepare;
    db.prepare = function (sql) {
      if (String(sql).indexOf('portfolio_url') !== -1) {
        return {
          bind: function () {
            return {
              run: async function () { throw new Error('no such column: portfolio_url'); }
            };
          }
        };
      }
      return realPrepare(sql);
    };

    var res = await submit(db, {
      role_id: 'web-ops',
      name: 'Ada',
      email: 'ada@example.com',
      country: 'Kenya',
      timezone: 'UTC+3',
      availability_hours: '8',
      pay_expectation: 'GH¢2,000 / month',
      cover_letter: 'I keep deploys boring.'
    });

    expect(res.status).toBe(201);
    var saved = (db._tables.career_applications || [])[0];
    expect(saved.job_title).toContain('Web');
    expect(saved.cover_letter).toContain('Role: web-ops');
    expect(saved.cover_letter).toContain('Country: Kenya');
    expect(saved.cover_letter).toContain('Availability: 8h/week');
  });
});
