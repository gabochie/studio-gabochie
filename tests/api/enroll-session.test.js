import { describe, it, expect } from 'vitest';
import { mockDb, buildContext } from '../helpers/mock-cf.js';

import { onRequest as enroll } from '../../functions/api/enroll/index.js';
import { onRequest as enrollLogin } from '../../functions/api/enroll/login.js';
import { onRequest as surveySubmit } from '../../functions/api/survey/submit.js';

function programRow() {
  return {
    id: 1, title: 'Systems Thinking', slug: 'systems-thinking',
    price: 250, price_label: 'Full Access', sample_content: '<p>sample</p>',
    full_content: '<p>full</p>', status: 'active',
  };
}

function postCtx(url, body, db) {
  return buildContext(url, {
    method: 'POST',
    env: { DB: db },
    request: new Request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  });
}

describe('unified sessions', function () {
  it('enroll POST mints a session token for the student', async function () {
    var db = mockDb({ programs: [programRow()], enrollments: [], users: [], sessions: [] });
    var res = await enroll(postCtx('http://localhost/api/enroll', {
      program_slug: 'systems-thinking', name: 'Ama', email: 'ama@example.com', phone: '',
    }, db));
    expect(res.status).toBe(200);
    var body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.enrollment.session_token).toMatch(/^[0-9a-f]{64}$/);
    expect(db._tables.users.length).toBe(1);
    expect(db._tables.users[0].email).toBe('ama@example.com');
    expect(db._tables.sessions.length).toBe(1);
    expect(db._tables.sessions[0].token).toBe(body.enrollment.session_token);
  });

  it('enroll POST reuses an existing user row', async function () {
    var db = mockDb({
      programs: [programRow()], enrollments: [],
      users: [{ id: 7, name: 'Ama', email: 'ama@example.com' }], sessions: [],
    });
    var res = await enroll(postCtx('http://localhost/api/enroll', {
      program_slug: 'systems-thinking', name: 'Ama', email: 'ama@example.com', phone: '',
    }, db));
    var body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.enrollment.session_token).toMatch(/^[0-9a-f]{64}$/);
    expect(db._tables.users.length).toBe(1);
    expect(db._tables.sessions[0].user_id).toBe(7);
  });

  it('enroll/login POST returns a session token', async function () {
    var db = mockDb({
      enrollments: [{ id: 1, program_id: 1, access_token: 'ga_abc', status: 'sample', student_email: 'ama@example.com' }],
      users: [], sessions: [],
    });
    var res = await enrollLogin(postCtx('http://localhost/api/enroll/login', { email: 'ama@example.com' }, db));
    expect(res.status).toBe(200);
    var body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.session_token).toMatch(/^[0-9a-f]{64}$/);
    expect(db._tables.sessions.length).toBe(1);
  });

  it('survey submit returns a session token for emailed leads', async function () {
    var db = mockDb({ programs: [programRow()] });
    var res = await surveySubmit(postCtx('http://localhost/api/survey/submit', {
      interests: ['systems'], other_text: '', name: 'Ama', email: 'ama@example.com', phone: '',
    }, db));
    expect(res.status).toBe(200);
    var body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.session_token).toMatch(/^[0-9a-f]{64}$/);
  });
});
