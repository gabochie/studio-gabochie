import { describe, it, expect } from 'vitest';
import { mockDb, buildContext } from '../helpers/mock-cf.js';
import { onRequest as authSession } from '../../functions/api/auth/session.js';
import { onRequest as authLogout } from '../../functions/api/auth/logout.js';
import { onRequest as enrollGet } from '../../functions/api/enroll/index.js';
import { onRequest as enrollProgress } from '../../functions/api/enroll/progress.js';
import { onRequest as guitarProgress } from '../../functions/api/guitar/progress.js';
import { onRequest as storeCreate } from '../../functions/api/store/create.js';
import { onRequest as adminTasks } from '../../functions/admin/api/tasks.js';

function req(url, opts) {
  opts = opts || {};
  return new Request(url, {
    method: opts.method || 'GET',
    headers: opts.headers || {},
    body: opts.body
  });
}

describe('auth/session includes membership_tier', function () {
  it('returns the tier from the users row', async function () {
    var db = mockDb({
      sessions: [{ token: 'tok-1', user_id: 7, expires_at: '2099-01-01' }],
      users: [{ id: 7, name: 'Ama', email: 'ama@test.com', email_verified: 1, created_at: '2024-01-01', membership_tier: 'premium' }]
    });
    // mockDb returns first-table rows; merge user fields onto the session row
    Object.assign(db._tables.sessions[0], db._tables.users[0]);
    var ctx = buildContext('http://localhost/api/auth/session', {
      env: { DB: db },
      request: req('http://localhost/api/auth/session', { headers: { Authorization: 'Bearer tok-1' } })
    });
    var res = await authSession(ctx);
    var data = await res.json();
    expect(res.status).toBe(200);
    expect(data.user.membership_tier).toBe('premium');
  });
});

describe('auth/logout accepts Authorization header', function () {
  it('deletes the session from a Bearer token with empty body', async function () {
    var db = mockDb({ sessions: [{ token: 'tok-9', user_id: 7 }] });
    var ctx = buildContext('http://localhost/api/auth/logout', {
      method: 'POST',
      env: { DB: db },
      request: new Request('http://localhost/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: 'Bearer tok-9' }
      })
    });
    var res = await authLogout(ctx);
    var data = await res.json();
    expect(res.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(db._tables.sessions.length).toBe(0);
  });

  it('still returns ok with no token at all', async function () {
    var db = mockDb({ sessions: [] });
    var ctx = buildContext('http://localhost/api/auth/logout', {
      method: 'POST',
      env: { DB: db },
      request: new Request('http://localhost/api/auth/logout', { method: 'POST' })
    });
    var res = await authLogout(ctx);
    expect((await res.json()).status).toBe('ok');
  });
});

describe('enroll GET honors ?program=', function () {
  function twoProgramDb() {
    return mockDb({
      enrollments: [
        { id: 1, program_id: 9, user_id: 7, student_name: 'Ama', student_email: 'ama@test.com', access_token: 'tok-A', status: 'active', slug: 'prog-a', program_slug: 'prog-a', program_title: 'Prog A' },
        { id: 2, program_id: 10, user_id: 7, student_name: 'Ama', student_email: 'ama@test.com', access_token: 'tok-B', status: 'sample', slug: 'prog-b', program_slug: 'prog-b', program_title: 'Prog B' }
      ]
    });
  }
  it('switches to the requested program enrollment', async function () {
    var ctx = buildContext('http://localhost/api/enroll?program=prog-b', {
      env: { DB: twoProgramDb() },
      request: req('http://localhost/api/enroll?program=prog-b&token=tok-A')
    });
    var data = await (await enrollGet(ctx)).json();
    expect(data.status).toBe('ok');
    expect(data.enrollment.program_slug).toBe('prog-b');
  });

  it('keeps the token enrollment when the program has no enrollment', async function () {
    var ctx = buildContext('http://localhost/api/enroll?program=prog-zzz', {
      env: { DB: twoProgramDb() },
      request: req('http://localhost/api/enroll?program=prog-zzz&token=tok-A')
    });
    var data = await (await enrollGet(ctx)).json();
    expect(data.status).toBe('ok');
    expect(data.enrollment.program_slug).toBe('prog-a');
  });
});

describe('progress POST reports xp_earned', function () {
  function progDb() {
    return mockDb({
      enrollments: [{ id: 1, program_id: 9, status: 'active', student_email: 'ama@test.com', xp: 0, xp_level: 1, streak: 0, last_module_at: '', access_token: 'tok-1' }],
      modules: [{ id: 5, slug: 'm1', program_id: 9 }],
      module_completions: []
    });
  }
  function postProgress(db, body) {
    return buildContext('http://localhost/api/enroll/progress', {
      method: 'POST',
      env: { DB: db },
      request: new Request('http://localhost/api/enroll/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
    });
  }
  it('awards xp_earned 100 on first completion', async function () {
    var data = await (await enrollProgress(postProgress(progDb(), { token: 'tok-1', module_slug: 'm1' }))).json();
    expect(data.status).toBe('ok');
    expect(data.xp_earned).toBe(100);
    expect(data.xp).toBe(100);
  });
  it('reports xp_earned 0 when already done', async function () {
    var db = progDb();
    db._tables.module_completions.push({ id: 1, enrollment_id: 1, module_id: 5 });
    var data = await (await enrollProgress(postProgress(db, { token: 'tok-1', module_slug: 'm1' }))).json();
    expect(data.status).toBe('ok');
    expect(data.already_done).toBe(true);
    expect(data.xp_earned).toBe(0);
  });
});

describe('guitar progress returns modules + current_module', function () {
  it('provides a flat module list the dashboard can render', async function () {
    var db = mockDb({
      guitar_user_stats: [{ user_id: 7, total_xp: 0, level: 1, streak: 0 }],
      guitar_progress: [{ user_id: 7, lesson_id: 1, completed: 1 }],
      guitar_modules: [
        { id: 1, tier: 'bronze', title: 'Meet Your Guitar', lesson_count: 2 },
        { id: 2, tier: 'bronze', title: 'The Fretboard', lesson_count: 2 }
      ],
      guitar_lessons: [
        { id: 1, module_id: 1, title: 'Parts' },
        { id: 2, module_id: 1, title: 'Hold' },
        { id: 3, module_id: 2, title: 'Strings' }
      ],
      guitar_user_achievements: [],
      guitar_achievements: [],
      guitar_practice_sessions: []
    });
    // mockDb has no users/sessions tables here; getUser needs sessions+users
    db._tables.sessions = [{ token: 'gtok', user_id: 7, expires_at: '2099-01-01' }];
    db._tables.users = [{ id: 7, email: 'ama@test.com', name: 'Ama' }];
    var ctx = buildContext('http://localhost/api/guitar/progress', {
      env: { DB: db },
      request: req('http://localhost/api/guitar/progress', { headers: { Authorization: 'Bearer gtok' } })
    });
    var data = await (await guitarProgress(ctx)).json();
    expect(Array.isArray(data.modules)).toBe(true);
    expect(data.modules.length).toBe(2);
    expect(data.modules[0].lessons.length).toBe(2);
    expect(data.current_module).toBe(1);
  });
});

describe('store create persists product_slug', function () {
  it('stores the merch slug on the order row', async function () {
    var db = mockDb({ store_orders: [] });
    var ctx = buildContext('http://localhost/api/store/create', {
      method: 'POST',
      env: { DB: db },
      request: new Request('http://localhost/api/store/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_type: 'merch', item_name: 'Nation Builder Tee', item_variant: 'M',
          product_slug: 'nation-builder-tee', amount: 120, customer_name: 'Ama',
          customer_email: 'ama@test.com'
        })
      })
    });
    var data = await (await storeCreate(ctx)).json();
    expect(data.status).toBe('ok');
    expect(db._tables.store_orders[0].product_slug).toBe('nation-builder-tee');
  });
});

describe('admin tasks ?phase filter', function () {
  it('filters items by phase', async function () {
    var db = mockDb({
      tasks: [
        { id: 1, title: 'A', phase: 4, status: 'completed' },
        { id: 2, title: 'B', phase: 5, status: 'pending' }
      ]
    });
    var ctx = buildContext('http://localhost/admin/api/tasks?phase=4', {
      env: { DB: db, ADMIN_API_KEY: 'k' },
      request: new Request('http://localhost/admin/api/tasks?phase=4', {
        headers: { 'X-Admin-Key': 'k' }
      })
    });
    var data = await (await adminTasks(ctx)).json();
    expect(data.status).toBe('ok');
    expect(data.items.length).toBe(1);
    expect(data.items[0].title).toBe('A');
  });
});
