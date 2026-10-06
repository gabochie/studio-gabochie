import { mintSessionForEmail } from '../enroll/_session.js';

var FLAGSHIP_SLUG = 'systems-thinking';

function genToken() {
  var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  var r = '';
  for (var i = 0; i < 24; i++) r += chars.charAt(Math.floor(Math.random() * chars.length));
  return 'ga_' + Date.now().toString(36) + '_' + r;
}

function sanitize(s, max) {
  s = (s || '').replace(/<[^>]*>/g, '').trim();
  return max ? s.slice(0, max) : s;
}

async function bestEffort(db, sql, params) {
  try { await db.prepare(sql).bind.apply(null, params).run(); } catch (_) {}
}

export async function onRequest(context) {
  var db = context.env.DB;
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }
  if (!db) {
    return json({ error: 'D1 not bound' }, 501);
  }
  try {
    var body = await context.request.json();
    var interests = body.interests;
    if (!interests || !Array.isArray(interests) || interests.length === 0) {
      return json({ error: 'Please select at least one interest' }, 400);
    }
    var other_text = sanitize(body.other_text, 2000);
    var name = sanitize(body.name, 100);
    var email = sanitize(body.email, 254).toLowerCase();
    var phone = sanitize(body.phone, 50);
    var hasEmail = email.indexOf('@') > 0;
    await db.prepare(
      'INSERT INTO survey_responses (name, email, phone, interests, other_text) VALUES (?, ?, ?, ?, ?)'
    ).bind(name, email, phone, JSON.stringify(interests), other_text).run();

    var isNewSubscriber = false;
    var enrollment = null;

    if (hasEmail) {
      // 1. Upsert subscriber (base columns work on every schema; extras best-effort)
      try {
        var existing = await db.prepare('SELECT id, name FROM subscribers WHERE email = ?').bind(email).first();
        if (!existing) {
          try {
            await db.prepare(
              'INSERT INTO subscribers (name, email, source, metadata) VALUES (?, ?, ?, ?)'
            ).bind(name, email, 'quiz', JSON.stringify({ interests: interests, onboarded_at: new Date().toISOString() })).run();
            isNewSubscriber = true;
          } catch (_e) {
            // Duplicate race or OR IGNORE unsupported in test mock — treat as existing
            try {
              await db.prepare(
                'INSERT OR IGNORE INTO subscribers (name, email, source, metadata) VALUES (?, ?, ?, ?)'
              ).bind(name, email, 'quiz', JSON.stringify({ interests: interests, onboarded_at: new Date().toISOString() })).run();
              isNewSubscriber = true;
            } catch (_) {}
          }
        } else if (name && !existing.name) {
          await bestEffort(db, 'UPDATE subscribers SET name = ? WHERE email = ?', [name, email]);
        }
      } catch (_) {}
      await bestEffort(db, 'UPDATE subscribers SET phone = ? WHERE email = ? AND (phone IS NULL OR phone = ?)', [phone, email, '']);
      await bestEffort(db, "UPDATE subscribers SET onboarding_tag = ? WHERE email = ? AND (onboarding_tag IS NULL OR onboarding_tag = ?)", ['quiz', email, '']);
      try {
        await db.prepare(
          "INSERT INTO events (event_type, event_data, page, email, created_at) VALUES (?, ?, ?, ?, datetime('now'))"
        ).bind('quiz_completed', JSON.stringify({ interests: interests, source: 'survey' }), '/survey/', email).run();
      } catch (_) {}

      // 2. Auto-enroll to flagship sample (Systems Thinking GH¢250 -> status sample)
      try {
        var program = await db.prepare('SELECT id, title, slug, price FROM programs WHERE slug = ?').bind(FLAGSHIP_SLUG).first();
        if (program && program.status !== 'coming_soon') {
          var displayName = name || email.split('@')[0];
          var found = await db.prepare('SELECT id, access_token, status FROM enrollments WHERE program_id = ? AND student_email = ?').bind(program.id, email).first();
          if (found) {
            enrollment = { program_slug: program.slug, access_level: found.status === 'active' ? 'full' : 'sample', access_token: found.access_token, dashboard_url: 'https://studio.gabochie.com/dashboard/?token=' + found.access_token, existing: true };
          } else {
            var token = genToken();
            var expiresAt = new Date(Date.now() + 7776000000).toISOString();
            var status = program.price > 0 ? 'sample' : 'active';
            try {
              await db.prepare(
                'INSERT INTO enrollments (program_id, student_name, student_email, student_phone, access_token, status, token_expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
              ).bind(program.id, displayName, email, phone, token, status, expiresAt).run();
            } catch (_e) {
              // Fallback for DBs without token_expires_at column
              await db.prepare(
                'INSERT INTO enrollments (program_id, student_name, student_email, student_phone, access_token, status) VALUES (?, ?, ?, ?, ?, ?)'
              ).bind(program.id, displayName, email, phone, token, status).run();
            }
            enrollment = { program_slug: program.slug, access_level: status === 'sample' ? 'sample' : 'full', access_token: token, dashboard_url: 'https://studio.gabochie.com/dashboard/?token=' + token, existing: false };
            try {
              await db.prepare(
                "INSERT INTO events (event_type, event_data, page, email, created_at) VALUES (?, ?, ?, ?, datetime('now'))"
              ).bind('utm_enroll', JSON.stringify({ utm_source: 'quiz', program_slug: program.slug }), '/courses/' + program.slug + '/', email).run();
            } catch (_) {}
            // Queue Day-0 + Day-1 nurture (processed by email/cron.js)
            try {
              var now = new Date().toISOString().replace('T', ' ').slice(0, 19);
              var d = new Date(); d.setDate(d.getDate() + 1);
              var tomorrow = d.toISOString().replace('T', ' ').slice(0, 19);
              await db.prepare(
                'INSERT INTO email_queue (to_email, to_name, subject, html_content, email_type, scheduled_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
              ).bind(email, displayName, 'Your builder type + free Module 1 — Studio Gabochie', '<p>Hi ' + displayName + ',</p><p>Based on your interests (' + interests.slice(0, 3).join(', ') + '), start with <strong>' + program.title + ' Module 1 (free)</strong>.</p><p><a href="' + enrollment.dashboard_url + '">Access your dashboard</a></p>', 'quiz_welcome', now, now).run();
              await db.prepare(
                'INSERT INTO email_queue (to_email, to_name, subject, html_content, email_type, scheduled_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
              ).bind(email, displayName, 'Did you finish Module 1? — Studio Gabochie', '<p>Hi ' + displayName + ',</p><p>Quick nudge — your free Module 1 is waiting. Finish it today, then unlock the full course.</p><p><a href="' + enrollment.dashboard_url + '">Continue Module 1</a></p>', 'quiz_followup_1d', tomorrow, now).run();
            } catch (_) {}
          }
        }
      } catch (_) {}
    }

    // Mint a user session so one login works everywhere (dashboard + member tiers).
    var sessionToken = '';
    if (hasEmail) {
      try { sessionToken = await mintSessionForEmail(db, email, name); } catch (_) {}
    }

    return json({ status: 'ok', lead: hasEmail ? { email: email, isNewSubscriber: isNewSubscriber } : null, enrollment: enrollment, next: enrollment ? enrollment.dashboard_url : null, session_token: sessionToken });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
