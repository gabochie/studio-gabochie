import { requireAdmin } from '../../_auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const authErr = requireAdmin(request, env);
  if (authErr) return authErr;

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ status: 'error', message: 'POST required' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  }

  let body;
  try { body = await request.json(); } catch (_) { body = {}; }
  if (!body.confirm || body.secret !== 'reset-all-guitar-users') {
    return new Response(JSON.stringify({ status: 'error', message: 'Set confirm:true and secret:"reset-all-guitar-users" in request body' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  const db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }

  const tables = [
    'guitar_one_minute_records',
    'guitar_tuner_history',
    'guitar_user_achievements',
    'guitar_practice_sessions',
    'guitar_progress',
    'guitar_payments',
    'guitar_conversion_events',
    'guitar_waitlist',
    'guitar_user_stats',
    'student_achievements',
    'certificates',
    'module_completions',
    'quiz_attempts',
    'sessions',
    'enrollments',
    'students',
    'users'
  ];

  const counts = {};
  const errors = [];

  for (const table of tables) {
    try {
      const result = await db.prepare(`DELETE FROM ${table}`).run();
      counts[table] = result.meta?.changes ?? 0;
    } catch (e) {
      errors.push({ table, error: e.message });
      counts[table] = -1;
    }
  }

  return new Response(JSON.stringify({
    status: 'ok',
    message: 'All guitar user data reset. Schema and curriculum preserved.',
    deleted: counts,
    errors: errors.length ? errors : undefined
  }), { headers: { 'Content-Type': 'application/json' } });
}
