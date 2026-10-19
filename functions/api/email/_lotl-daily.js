// Daily "Focus on The Love of The Lord" devotional broadcast.
//
// The source of truth for content is the published daily pack under
// /love-of-the-lord/daily/<YYYY-MM>.json (already precached by the service
// worker and served by Pages). This module renders one email per recipient,
// enqueues them into email_queue (email_type = 'lotl_daily') so they inherit
// the shared drain: signed unsubscribe, open pixel, click rewriting, the
// suppression list, retries and the daily Brevo cap.
//
// Sending is opt-in: only confirmed subscribers with lotl_daily = 1 are
// targeted. A broadcast is guarded once-per-day by the lotl_daily_sends table
// so a cron tick that runs more than once can never double-send.

export const LOTL_DAILY_TYPE = 'lotl_daily';
export const LOTL_DAILY_ENABLED_KEY = 'lotl_daily_enabled';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

export function todayKey(d) {
  return (d ? d : new Date()).toISOString().slice(0, 10);
}

export function monthPackUrl(baseUrl, date) {
  return String(baseUrl).replace(/\/$/, '') + '/love-of-the-lord/daily/' + String(date).slice(0, 7) + '.json';
}

export function devotionalUrl(baseUrl, date) {
  return String(baseUrl).replace(/\/$/, '') + '/love-of-the-lord/devotionals/?utm_source=lotl&utm_medium=email&utm_campaign=lotl-daily&utm_content=' + encodeURIComponent(String(date));
}

export function shareUrls(baseUrl, day) {
  var text = (day && day.declaration ? day.declaration : 'I walk in the love of the Lord.') + ' — Focus on The Love of The Lord ' + (day && day.date ? day.date : '');
  var url = devotionalUrl(baseUrl, day && day.date);
  return {
    text: text,
    url: url,
    wa: 'https://wa.me/?text=' + encodeURIComponent(text + '\n' + url),
    xt: 'https://x.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url),
    fb: 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url)
  };
}

function section(label, body) {
  return '<tr><td style="padding:0 0 18px">' +
    '<p style="font-family:\'Barlow Condensed\',sans-serif;font-size:12px;letter-spacing:.2em;color:#C9A84C;margin:0 0 6px;text-transform:uppercase">' + esc(label) + '</p>' +
    '<p style="font-family:Georgia,serif;font-size:15px;color:#C8D4E4;line-height:1.75;margin:0">' + esc(body) + '</p>' +
    '</td></tr>';
}

export function buildLotlDailyHtml(pack, day, baseUrl) {
  baseUrl = String(baseUrl || 'https://studio.gabochie.com').replace(/\/$/, '');
  var s = shareUrls(baseUrl, day);
  var dateLabel = (day.date || '') + (day.weekday ? ' · ' + day.weekday : '');
  var buttons =
    '<tr><td style="padding:6px 0 22px">' +
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>' +
      '<td style="padding-right:8px"><a href="' + esc(devotionalUrl(baseUrl, day.date)) + '" style="display:inline-block;background:#C9A84C;color:#0A1628;text-decoration:none;font-family:\'Barlow Condensed\',sans-serif;font-size:13px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:12px 22px;border-radius:6px">Read online</a></td>' +
      '<td><a href="' + esc(s.wa) + '" style="display:inline-block;background:transparent;border:1px solid #1E3250;color:#C9A84C;text-decoration:none;font-family:\'Barlow Condensed\',sans-serif;font-size:13px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:12px 22px;border-radius:6px">Share ↗</a></td>' +
      '</tr></table>' +
    '</td></tr>';

  return '<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#0A1628;padding:40px 20px;margin:0">' +
    '<table role="presentation" width="560" align="center" style="background:#0F1E38;border:1px solid #1E3250;border-radius:10px;padding:36px">' +
    '<tr><td style="text-align:center;padding-bottom:18px;border-bottom:1px solid #1E3250">' +
      '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:11px;letter-spacing:.45em;color:#C9A84C;text-transform:uppercase">Love Of The Lord · Global Ministry</span>' +
      '<p style="font-family:\'Barlow Condensed\',sans-serif;font-size:13px;color:#5A7A9F;margin:8px 0 0;text-transform:uppercase;letter-spacing:.15em">' + esc(dateLabel) + '</p>' +
    '</td></tr>' +
    '<tr><td style="padding:26px 0 8px">' +
      '<h1 style="font-family:\'Barlow Condensed\',sans-serif;font-size:28px;font-weight:700;color:#E8EEF7;margin:0 0 6px">' + esc(day.serviceTheme || 'Daily Decree') + '</h1>' +
      '<p style="font-family:Georgia,serif;font-size:14px;color:#C9A84C;margin:0 0 14px;font-style:italic">' + esc(day.scripture || '') + '</p>' +
      '<div style="border-left:3px solid #C9A84C;padding:10px 0 10px 16px;margin:0 0 22px">' +
        '<p style="font-family:Georgia,serif;font-size:16px;color:#E8EEF7;line-height:1.7;margin:0;font-style:italic">' + esc(day.verse || '') + '</p>' +
      '</div>' +
    '</td></tr>' +
    (day.dimensionLabel ? '<tr><td style="padding:0 0 16px"><p style="font-family:\'Barlow Condensed\',sans-serif;font-size:11px;color:#5A7A9F;margin:0;letter-spacing:.15em;text-transform:uppercase">Today\u2019s focus · ' + esc(day.dimensionLabel) + '</p></td></tr>' : '') +
    section('Teaching', day.teaching) +
    section('Prayer', day.prayer) +
    '<tr><td style="padding:0 0 18px"><div style="background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.35);border-radius:8px;padding:16px">' +
      '<p style="font-family:\'Barlow Condensed\',sans-serif;font-size:12px;letter-spacing:.2em;color:#C9A84C;margin:0 0 6px;text-transform:uppercase">Declaration</p>' +
      '<p style="font-family:Georgia,serif;font-size:17px;color:#E8EEF7;line-height:1.7;margin:0;font-weight:700">' + esc(day.declaration || '') + '</p>' +
    '</div></td></tr>' +
    section('Decree', day.decree) +
    section('Your action today', day.action) +
    buttons +
    '<tr><td style="border-top:1px solid #1E3250;padding-top:16px">' +
      '<p style="font-family:Georgia,serif;font-size:13px;color:#5A7A9F;line-height:1.6;margin:0">You are receiving this because you asked for the daily devotional. <a href="' + esc(baseUrl + '/unsubscribe/') + '" style="color:#94A3B8">Unsubscribe</a> · <a href="' + esc(baseUrl + '/love-of-the-lord/') + '" style="color:#94A3B8">Have church with us</a> · love@gabochie.com</p>' +
    '</td></tr>' +
    '</table></body></html>';
}

export function lotlDailySubject(day) {
  return 'Daily decree · ' + (day && day.date ? day.date : '') + ' — ' + (day && day.serviceTheme ? day.serviceTheme : 'Focus on The Love of The Lord');
}

// Fetch the published pack for a given YYYY-MM and pull the single day out.
export async function fetchLotlDay(env, date) {
  var baseUrl = env.PUBLIC_BASE_URL || 'https://studio.gabochie.com';
  var pack;
  try {
    var res = await fetch(monthPackUrl(baseUrl, date), { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    pack = await res.json();
  } catch (_err) {
    return null;
  }
  var days = (pack && pack.days) || [];
  for (var i = 0; i < days.length; i++) {
    if (days[i].date === date) return { pack: pack, day: days[i] };
  }
  return null;
}

export async function lotlDailyEnabled(env) {
  var row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(LOTL_DAILY_ENABLED_KEY).first();
  return !!(row && String(row.value) === '1');
}

export async function setLotlDailyEnabled(env, on) {
  await env.DB.prepare(
    "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) " +
    "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')"
  ).bind(LOTL_DAILY_ENABLED_KEY, on ? '1' : '0').run();
  return on ? '1' : '0';
}

export async function lotlDailyAudienceCount(db) {
  var row = await db.prepare(
    "SELECT COUNT(*) AS cnt FROM subscribers WHERE confirmed = 1 AND lotl_daily = 1 AND email != ''"
  ).first();
  return (row && row.cnt) || 0;
}

export async function lotlDailySentFor(db, date) {
  var row = await db.prepare('SELECT total FROM lotl_daily_sends WHERE send_date = ?').bind(date).first();
  return row || null;
}

// Enqueue the broadcast. Returns { ok, date, enqueued, total, subject } or
// { ok:false, error }. opts.email forces a single test recipient; opts.audience
// of 'all_confirmed' is only used by the admin "opt-in everyone" flow.
export async function enqueueLotlDaily(env, opts) {
  opts = opts || {};
  var db = env.DB;
  var date = opts.date || todayKey();
  var testEmail = (opts.email || '').trim();
  var subject, html;

  if (opts.audience === 'all_confirmed') {
    subject = opts.subject || 'Get the daily devotional from Love Of The Lord';
    html = opts.html || '';
    var rows0 = await db.prepare("SELECT email, name FROM subscribers WHERE confirmed = 1 AND email != '' ORDER BY id ASC").all();
    var list0 = rows0.results || [];
    if (!list0.length) return { ok: false, error: 'No confirmed subscribers' };
    for (var i0 = 0; i0 < list0.length; i0++) {
      await db.prepare(
        "INSERT INTO email_queue (to_email, to_name, subject, html_content, email_type, scheduled_at, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))"
      ).bind(list0[i0].email, list0[i0].name || '', subject, html, LOTL_DAILY_TYPE).run();
    }
    return { ok: true, date: date, enqueued: list0.length, total: list0.length, subject: subject, kind: 'optin' };
  }

  var hit = await fetchLotlDay(env, date);
  if (!hit) return { ok: false, error: 'No devotional published for ' + date };
  var pack = hit.pack;
  var day = hit.day;
  var baseUrl = env.PUBLIC_BASE_URL || 'https://studio.gabochie.com';
  subject = lotlDailySubject(day);
  html = buildLotlDailyHtml(pack, day, baseUrl);

  if (testEmail) {
    await db.prepare(
      "INSERT INTO email_queue (to_email, to_name, subject, html_content, email_type, scheduled_at, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))"
    ).bind(testEmail, '', subject, html, LOTL_DAILY_TYPE).run();
    return { ok: true, date: date, enqueued: 1, total: 1, subject: subject, test: true, kind: 'test' };
  }

  var already = await lotlDailySentFor(db, date);
  if (already) return { ok: false, error: 'Already sent for ' + date + ' (' + already.total + ' recipients)' };

  var rows = await db.prepare(
    "SELECT email, name FROM subscribers WHERE confirmed = 1 AND lotl_daily = 1 AND email != '' ORDER BY id ASC"
  ).all();
  var list = rows.results || [];
  if (!list.length) return { ok: false, error: 'No opted-in subscribers yet' };

  // Claim the day first with an INSERT OR IGNORE so two overlapping cron ticks
  // can never both enqueue the broadcast. Only the winner proceeds.
  var claim = await db.prepare(
    "INSERT OR IGNORE INTO lotl_daily_sends (send_date, total, created_at) VALUES (?, ?, datetime('now'))"
  ).bind(date, list.length).run();
  var claimed = claim && claim.meta ? claim.meta.changes : 1;
  if (!claimed) return { ok: false, error: 'Already sent for ' + date + ' (claimed by another run)' };

  for (var i = 0; i < list.length; i++) {
    await db.prepare(
      "INSERT INTO email_queue (to_email, to_name, subject, html_content, email_type, scheduled_at, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))"
    ).bind(list[i].email, list[i].name || '', subject, html, LOTL_DAILY_TYPE).run();
  }

  return { ok: true, date: date, enqueued: list.length, total: list.length, subject: subject, kind: 'broadcast' };
}
