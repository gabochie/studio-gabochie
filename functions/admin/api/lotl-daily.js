import { requireAdmin } from '../_auth.js';
import {
  enqueueLotlDaily, buildLotlDailyHtml, fetchLotlDay, lotlDailySubject,
  lotlDailyEnabled, setLotlDailyEnabled, lotlDailyAudienceCount, lotlDailySentFor, todayKey
} from '../../api/email/_lotl-daily.js';

// Admin control surface for the daily devotional broadcast: preview today's
// email, test-send it to yourself, flip the auto-send switch, and see whether
// today has already been enqueued. Nothing here sends without an explicit POST.

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB) return json({ status: 'error', message: 'D1 not bound' }, 501);
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  try {
    const baseUrl = env.PUBLIC_BASE_URL || 'https://studio.gabochie.com';

    if (request.method === 'GET') {
      const url = new URL(request.url);
      const date = url.searchParams.get('date') || todayKey();
      const hit = await fetchLotlDay(env, date);
      const enabled = await lotlDailyEnabled(env);
      const audience = await lotlDailyAudienceCount(env.DB);
      const sent = await lotlDailySentFor(env.DB, date);
      const totalConfirmed = await env.DB.prepare("SELECT COUNT(*) AS cnt FROM subscribers WHERE confirmed = 1 AND email != ''").first();

      const day = hit && hit.day;
      return json({
        status: 'ok',
        date: date,
        enabled: enabled,
        has_content: !!day,
        subject: day ? lotlDailySubject(day) : null,
        audience: audience,
        confirmed_subscribers: (totalConfirmed && totalConfirmed.cnt) || 0,
        sent_today: sent || null,
        preview_html: hit ? buildLotlDailyHtml(hit.pack, hit.day, baseUrl) : null,
        day: day ? {
          date: day.date, weekday: day.weekday, serviceTheme: day.serviceTheme,
          scripture: day.scripture, verse: day.verse, declaration: day.declaration,
          dimensionLabel: day.dimensionLabel
        } : null
      });
    }

    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    let body = {};
    try { body = await request.json(); } catch (_e) { body = {}; }
    const action = body.action || '';

    if (action === 'enable' || action === 'disable') {
      await setLotlDailyEnabled(env, action === 'enable');
      return json({ status: 'ok', enabled: action === 'enable' });
    }

    if (action === 'test') {
      const email = String(body.email || '').trim();
      if (!email || email.indexOf('@') < 0) return json({ status: 'error', message: 'A valid email is required' }, 400);
      const res = await enqueueLotlDaily(env, { email: email, date: body.date || todayKey() });
      return json(res);
    }

    if (action === 'send') {
      const res = await enqueueLotlDaily(env, { date: body.date || todayKey() });
      return json(res);
    }

    if (action === 'optin') {
      const date = body.date || todayKey();
      const hit = await fetchLotlDay(env, date);
      if (!hit) return json({ status: 'error', message: 'No devotional for ' + date }, 400);
      const subject = 'Get today\u2019s decree from Love Of The Lord';
      const html = optinInviteHtml(hit.day, baseUrl);
      const res = await enqueueLotlDaily(env, { date: date, audience: 'all_confirmed', subject: subject, html: html });
      return json(res);
    }

    return json({ status: 'error', message: 'Unknown action' }, 400);
  } catch (_err) {
    return json({ status: 'error', message: 'Internal error' }, 500);
  }
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function optinInviteHtml(day, baseUrl) {
  const url = String(baseUrl).replace(/\/$/, '') + '/love-of-the-lord/devotionals/?utm_source=lotl&utm_medium=email&utm_campaign=lotl-daily-optin';
  return '<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#FAFAFA;padding:40px 20px">' +
    '<table align="center" width="560" style="background:#fff;border-radius:8px;padding:40px">' +
    '<tr><td style="text-align:center;padding-bottom:20px;border-bottom:1px solid #E2E6ED">' +
      '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:11px;letter-spacing:.45em;color:#C9A84C;text-transform:uppercase">Love Of The Lord · Global Ministry</span>' +
    '</td></tr>' +
    '<tr><td style="padding:32px 0 24px">' +
      '<h1 style="font-family:\'Barlow Condensed\',sans-serif;font-size:28px;font-weight:700;color:#0A1628;margin:0 0 8px">Would you like the <span style="color:#C9A84C">daily decree</span>?</h1>' +
      '<p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 16px">Hello,</p>' +
      '<p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 16px">Today\u2019s decree is on <em>' + esc(day.serviceTheme || 'the love of the Lord') + '</em> — a short teaching, prayer, declaration and decree you can pray in under two minutes.</p>' +
      '<p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 24px">Reply to this email with the word <strong>DAILY</strong> — or subscribe on the devotionals page — and we will send one a day. One email a day, always with an unsubscribe link.</p>' +
      '<div style="text-align:center;margin:24px 0">' +
        '<a href="' + esc(url) + '" style="display:inline-block;background:#C9A84C;color:#0A1628;text-decoration:none;font-family:\'Barlow Condensed\',sans-serif;font-size:15px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:14px 36px;border-radius:6px">Start the daily decree</a>' +
      '</div>' +
    '</td></tr>' +
    '<tr><td style="text-align:center;padding-top:20px;border-top:1px solid #E2E6ED">' +
      '<p style="font-family:\'Courier Prime\',monospace;font-size:10px;color:#94A3B8;margin:0">Love Of The Lord · Accra, Ghana · <a href="' + esc(String(baseUrl).replace(/\/$/, '') + '/unsubscribe/') + '" style="color:#94A3B8">Unsubscribe</a></p>' +
    '</td></tr>' +
    '</table></body></html>';
}
