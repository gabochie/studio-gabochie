import { getToken, getSessionUser } from './_token.js';
function calcLevel(xp) {
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

export async function onRequest(context) {
  var { request, env } = context;
  var db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }

  if (request.method === 'GET') {
    var token = getToken(request);
    if (!token) {
      return new Response(JSON.stringify({ status: 'error', message: 'Missing token' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    try {
      var enrollment = await db.prepare(
        'SELECT id, program_id, status, student_email, xp, xp_level, streak, user_id FROM enrollments WHERE access_token = ?'
      ).bind(token).first();
      if (!enrollment) {
        var session = await getSessionUser(db, token);
        if (session) {
          enrollment = await db.prepare(
            'SELECT id, program_id, status, student_email, xp, xp_level, streak, user_id FROM enrollments WHERE user_id = ? ORDER BY enrolled_at DESC LIMIT 1'
          ).bind(session.user_id).first();
          if (!enrollment) {
            enrollment = await db.prepare(
              'SELECT id, program_id, status, student_email, xp, xp_level, streak, user_id FROM enrollments WHERE student_email = ? ORDER BY enrolled_at DESC LIMIT 1'
            ).bind(session.email).first();
          }
        }
      }
      if (!enrollment) {
        return new Response(JSON.stringify({ status: 'error', message: 'Invalid token' }), {
          status: 404, headers: { 'Content-Type': 'application/json' }
        });
      }
      var modules = await db.prepare(
        `SELECT m.id, m.title, m.slug, m.description, m.sort_order,
                CASE WHEN mc.id IS NOT NULL THEN 1 ELSE 0 END AS completed,
                mc.completed_at
         FROM modules m
         LEFT JOIN module_completions mc ON mc.module_id = m.id AND mc.enrollment_id = ?
         WHERE m.program_id = ?
         ORDER BY m.sort_order ASC`
      ).bind(enrollment.id, enrollment.program_id).all();
      var total = modules.results.length;
      var done = modules.results.filter(function(m) { return m.completed === 1; }).length;
      return new Response(JSON.stringify({
        status: 'ok',
        enrollment_id: enrollment.id,
        program_id: enrollment.program_id,
        total_modules: total,
        completed_modules: done,
        progress_pct: total > 0 ? Math.round((done / total) * 100) : 0,
        modules: modules.results,
        xp: enrollment.xp || 0,
        level: enrollment.xp_level || 1,
        streak: enrollment.streak || 0
      }), { headers: { 'Content-Type': 'application/json' } });
    } catch (_err) {
      return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    var body = await request.json();
    var postToken = getToken(request, body);
    var moduleSlug = body.module_slug || '';
    if (!postToken || !moduleSlug) {
      return new Response(JSON.stringify({ status: 'error', message: 'Missing token or module_slug' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    enrollment = await db.prepare(
      'SELECT id, program_id, status, student_email, xp, xp_level, streak, last_module_at FROM enrollments WHERE access_token = ?'
    ).bind(postToken).first();
    if (!enrollment) {
      session = await getSessionUser(db, postToken);
      if (session) {
        enrollment = await db.prepare(
          'SELECT id, program_id, status, student_email, xp, xp_level, streak, last_module_at FROM enrollments WHERE user_id = ? ORDER BY enrolled_at DESC LIMIT 1'
        ).bind(session.user_id).first();
        if (!enrollment) {
          enrollment = await db.prepare(
            'SELECT id, program_id, status, student_email, xp, xp_level, streak, last_module_at FROM enrollments WHERE student_email = ? ORDER BY enrolled_at DESC LIMIT 1'
          ).bind(session.email).first();
        }
      }
    }
    if (!enrollment) {
      return new Response(JSON.stringify({ status: 'error', message: 'Invalid token' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      });
    }
    if (enrollment.status !== 'active') {
      return new Response(JSON.stringify({ status: 'error', message: 'Full access required to track progress' }), {
        status: 403, headers: { 'Content-Type': 'application/json' }
      });
    }
    var moduleRow = await db.prepare(
      'SELECT id FROM modules WHERE slug = ? AND program_id = ?'
    ).bind(moduleSlug, enrollment.program_id).first();
    if (!moduleRow) {
      return new Response(JSON.stringify({ status: 'error', message: 'Module not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if already completed (idempotent)
    var existing = await db.prepare(
      'SELECT id FROM module_completions WHERE enrollment_id = ? AND module_id = ?'
    ).bind(enrollment.id, moduleRow.id).first();

    var alreadyDone = !!existing;

    if (!alreadyDone) {
      await db.prepare(
        'INSERT OR IGNORE INTO module_completions (enrollment_id, module_id) VALUES (?, ?)'
      ).bind(enrollment.id, moduleRow.id).run();

      // Award XP
      var newXp = (enrollment.xp || 0) + 100;
      var newLevel = calcLevel(newXp);

      // Update streak
      var today = new Date().toISOString().slice(0, 10);
      var lastDate = enrollment.last_module_at ? enrollment.last_module_at.slice(0, 10) : '';
      var newStreak = 1;
      if (lastDate === today) {
        newStreak = enrollment.streak || 1;
      } else if (lastDate === new Date(Date.now() - 86400000).toISOString().slice(0, 10)) {
        newStreak = (enrollment.streak || 0) + 1;
      }

      await db.prepare(
        'UPDATE enrollments SET xp = ?, xp_level = ?, streak = ?, last_module_at = datetime(\'now\') WHERE id = ?'
      ).bind(newXp, newLevel, newStreak, enrollment.id).run();

      // Check achievements
      var totalMods = await db.prepare(
        'SELECT COUNT(*) AS c FROM modules WHERE program_id = ?'
      ).bind(enrollment.program_id).first();
      var doneMods = await db.prepare(
        'SELECT COUNT(*) AS c FROM module_completions WHERE enrollment_id = ?'
      ).bind(enrollment.id).first();
      total = totalMods.c;
      done = doneMods.c;

      var newAchievements = [];

      // Check first_step
      if (done >= 1) {
        await tryAward(db, enrollment, 'first_step', newAchievements);
      }
      // Check halfway
      if (done >= Math.ceil(total / 2)) {
        await tryAward(db, enrollment, 'halfway', newAchievements);
      }
      // Check scholar
      if (done >= total) {
        await tryAward(db, enrollment, 'scholar', newAchievements);
      }
      // Check on_fire (2 modules on same day)
      var todayMods = await db.prepare(
        "SELECT COUNT(*) AS c FROM module_completions WHERE enrollment_id = ? AND date(completed_at) = date('now')"
      ).bind(enrollment.id).first();
      if (todayMods.c >= 2) {
        await tryAward(db, enrollment, 'on_fire', newAchievements);
      }
      // Check perfect_week (5 different days in same ISO week)
      var weekDays = await db.prepare(
        "SELECT COUNT(DISTINCT date(completed_at)) AS c FROM module_completions WHERE enrollment_id = ? AND completed_at >= date('now', 'weekday 1', '-7 days') AND completed_at < date('now', 'weekday 1', '+0 days')"
      ).bind(enrollment.id).first();
      if (weekDays.c >= 5) {
        await tryAward(db, enrollment, 'perfect_week', newAchievements);
      }

      return new Response(JSON.stringify({
        status: 'ok',
        module_slug: moduleSlug,
        completed: true,
        xp: newXp,
        level: newLevel,
        streak: newStreak,
        new_achievements: newAchievements
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // Already completed — still return updated stats
    return new Response(JSON.stringify({
      status: 'ok',
      module_slug: moduleSlug,
      completed: true,
      already_done: true,
      xp: enrollment.xp || 0,
      level: enrollment.xp_level || 1,
      streak: enrollment.streak || 0,
      new_achievements: []
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function tryAward(db, enrollment, key, list) {
  try {
    var existing = await db.prepare(
      'SELECT id FROM student_achievements WHERE student_email = ? AND enrollment_id = ? AND achievement_key = ?'
    ).bind(enrollment.student_email, enrollment.id, key).first();
    if (!existing) {
      await db.prepare(
        'INSERT INTO student_achievements (student_email, enrollment_id, achievement_key) VALUES (?, ?, ?)'
      ).bind(enrollment.student_email, enrollment.id, key).run();
      var def = await db.prepare('SELECT name, icon FROM achievements WHERE key = ?').bind(key).first();
      list.push({ key: key, name: def ? def.name : key, icon: def ? def.icon : '' });
    }
  } catch (_) {}
}
