import { requireAdminAuth } from './_admin-auth.js';
import { CONTENT_CALENDAR_PLAN } from '../../../scripts/content-calendar-plan.js';

var CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key, X-CI-Secret'
};

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...CORS }
  });
}

function text(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max || 500);
}

function stamp(value) {
  return text(value, 30).replace('T', ' ').replace('Z', '').slice(0, 19);
}

function planKey(item) {
  return 'day-' + item.day + '-' + item.utm_campaign + '-' + item.platform;
}

function planDate(day) {
  var d = new Date();
  d.setUTCDate(d.getUTCDate() + (Number(day) - 1));
  d.setUTCHours(9, 0, 0, 0);
  return stamp(d.toISOString());
}

var STATUSES = ['planned', 'ready', 'due', 'posted', 'skipped'];
var EDITABLE = {
  day: 'number', week: 'number', arc: 'text', pillar: 'text', platform: 'text',
  format: 'text', hook: 'text', paths: 'text', cta: 'text',
  utm_campaign: 'text', hard_cta: 'number', cta_url: 'text', alt_url: 'text',
  notes: 'text', scheduled_at: 'date', status: 'status'
};

export async function onRequest(context) {
  var { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  var authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;
  if (!env.DB) return json({ status: 'error', message: 'D1 not bound' }, 501);

  try {
    var url = new URL(request.url);

    if (request.method === 'GET') {
      var { results: items } = await env.DB.prepare(
        'SELECT * FROM social_queue ORDER BY day ASC, id ASC LIMIT 200'
      ).all();
      var { results: posts } = await env.DB.prepare(
        "SELECT id, slug, title, status, published_at, scheduled_at, utm_campaign FROM posts WHERE status IN ('draft', 'scheduled', 'published') ORDER BY COALESCE(scheduled_at, published_at) DESC LIMIT 100"
      ).all();
      return json({ status: 'ok', items: items || [], posts: posts || [], count: (items || []).length });
    }

    if (request.method === 'POST') {
      var body = await request.json().catch(function () { return {}; });

      if (body.seed) {
        var seeded = 0;
        for (var item of CONTENT_CALENDAR_PLAN) {
          try {
            // OR IGNORE preserves admin edits and makes re-seeding safe.
            await env.DB.prepare(
              `INSERT OR IGNORE INTO social_queue (plan_key, day, week, arc, pillar, platform, format, hook, paths, cta, utm_campaign, hard_cta, cta_url, alt_url, scheduled_at, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'planned')`
            ).bind(
              planKey(item), item.day, item.week, text(item.arc, 120), text(item.pillar, 60),
              text(item.platform, 40), text(item.format, 80), text(item.hook, 500),
              text(item.paths, 120), text(item.cta, 160), text(item.utm_campaign, 80),
              item.hard_cta ? 1 : 0, text(item.cta_url, 500), text(item.alt_url, 500),
              planDate(item.day)
            ).run();
            seeded++;
          } catch (_e) {}
        }
        return json({ status: 'ok', seeded: seeded }, 201);
      }

      var hook = text(body.hook, 500);
      if (!hook) return json({ status: 'error', message: 'hook required' }, 400);
      var platform = text(body.platform, 40) || 'instagram';
      var key = 'custom-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      var created = await env.DB.prepare(
        `INSERT INTO social_queue (plan_key, day, week, arc, pillar, platform, format, hook, paths, cta, utm_campaign, hard_cta, cta_url, alt_url, scheduled_at, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        key, Number(body.day) || 0, Number(body.week) || 0, text(body.arc, 120),
        text(body.pillar, 60), platform, text(body.format, 80), hook,
        text(body.paths, 120), text(body.cta, 160), text(body.utm_campaign, 80),
        body.hard_cta ? 1 : 0, text(body.cta_url, 500), text(body.alt_url, 500),
        stamp(body.scheduled_at) || stamp(new Date().toISOString()),
        STATUSES.indexOf(body.status) >= 0 ? body.status : 'planned', text(body.notes, 1000)
      ).run();
      var row = await env.DB.prepare('SELECT * FROM social_queue WHERE id = ?').bind(created.meta.last_row_id).first();
      return json({ status: 'ok', item: row }, 201);
    }

    if (request.method === 'PUT') {
      var put = await request.json().catch(function () { return {}; });
      var id = Number(put.id || url.searchParams.get('id')) || 0;
      if (!id) return json({ status: 'error', message: 'id required' }, 400);

      var sets = [];
      var values = [];
      Object.keys(put).forEach(function (field) {
        var kind = EDITABLE[field];
        if (!kind) return;
        var value = put[field];
        if (kind === 'number') value = Number(value) || 0;
        else if (kind === 'date') value = stamp(value);
        else if (kind === 'status') {
          if (STATUSES.indexOf(value) < 0) return;
        } else value = text(value, 1000);
        sets.push(field + ' = ?');
        values.push(value);
      });

      if (put.status === 'posted') {
        sets.push('posted_at = ?');
        values.push(stamp(new Date().toISOString()));
      }
      if (!sets.length) return json({ status: 'error', message: 'no editable fields' }, 400);
      sets.push('updated_at = ?');
      values.push(stamp(new Date().toISOString()));
      values.push(id);

      await env.DB.prepare('UPDATE social_queue SET ' + sets.join(', ') + ' WHERE id = ?').bind(...values).run();
      var updated = await env.DB.prepare('SELECT * FROM social_queue WHERE id = ?').bind(id).first();
      return json({ status: 'ok', item: updated });
    }

    if (request.method === 'DELETE') {
      var delId = Number(url.searchParams.get('id')) || 0;
      if (!delId) return json({ status: 'error', message: 'id required' }, 400);
      await env.DB.prepare('DELETE FROM social_queue WHERE id = ?').bind(delId).run();
      return json({ status: 'ok', deleted: delId });
    }

    return json({ status: 'error', message: 'Method not allowed' }, 405);
  } catch (err) {
    return json({ status: 'error', message: err.message || 'Internal error' }, 500);
  }
}
