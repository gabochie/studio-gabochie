import { queueEmail, manifestoFollowup, daysFromNow } from './email/_send.js';
import { requireAdminAuth } from './admin/_admin-auth.js';
import { checkRateLimit } from './_rate-limit.js';

const notifyHtml = (name, email, msg, source) => `<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#FAFAFA;padding:20px">
  <h2 style="color:#0A1628">New Contact Submission</h2>
  <table style="font-family:Georgia,serif;font-size:15px;color:#6B7F9A;border-collapse:collapse;width:100%">
    <tr><td style="padding:8px 12px;border:1px solid #E2E6ED;font-weight:700;width:80px">Name:</td><td style="padding:8px 12px;border:1px solid #E2E6ED">${name}</td></tr>
    <tr><td style="padding:8px 12px;border:1px solid #E2E6ED;font-weight:700">Email:</td><td style="padding:8px 12px;border:1px solid #E2E6ED">${email}</td></tr>
    <tr><td style="padding:8px 12px;border:1px solid #E2E6ED;font-weight:700">Source:</td><td style="padding:8px 12px;border:1px solid #E2E6ED">${source}</td></tr>
    ${msg ? `<tr><td style="padding:8px 12px;border:1px solid #E2E6ED;font-weight:700">Message:</td><td style="padding:8px 12px;border:1px solid #E2E6ED">${msg}</td></tr>` : ''}
  </table>
  <p style="font-size:12px;color:#94A3B8;margin-top:16px"><a href="https://gideonabochie.org/admin/agents.html">Go to Command Center</a></p></body></html>`;

export async function onRequest(context) {
  const { request, env } = context;

  // GET — admin subscriber listing (protected by admin key)
  if (request.method === 'GET') {
    var authError = requireAdminAuth(request, env);
    if (authError) return authError;
    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
        status: 501, headers: { 'Content-Type': 'application/json' }
      });
    }
    try {
      const { results } = await db.prepare(
        "SELECT * FROM subscribers ORDER BY subscribed_at DESC"
      ).all();
      return new Response(JSON.stringify({ status: 'ok', count: results.length, items: results }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'X-Admin-Key' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // POST — form submission
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', 'Allow': 'GET, POST' }
    });
  }
  var ip = request.headers.get('CF-Connecting-IP') || '';
  if (!await checkRateLimit(env.DB, ip, 'contact', 5, 60)) {
    return new Response(JSON.stringify({ status: 'error', message: 'Too many submissions. Try again later.' }), {
      status: 429, headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
    const formData = await request.formData();
    const name = formData.get('name') || '';
    const email = formData.get('email') || '';
    const phone = formData.get('phone') || '';
    const msg = formData.get('message') || '';
    const book = formData.get('book') || formData.get('_subject') || '';
    const spam = formData.get('_gotcha');
    if (spam) {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    const db = env.DB;
    const notify = env.NOTIFY_EMAIL || 'gid@gideonabochie.com';
    if (db && email) {
      await db.prepare(
        `INSERT OR IGNORE INTO subscribers (name, email, source, book, phone) VALUES (?, ?, ?, ?, ?)`
      ).bind(name, email, book || 'contact', book || '', phone).run();
      if (phone) {
        await db.prepare("UPDATE subscribers SET phone = ? WHERE email = ? AND (phone IS NULL OR phone = '')").bind(phone, email).run();
      }
      // Store in contact_submissions for admin review
      await db.prepare(
        `INSERT INTO contact_submissions (name, email, subject, message, source) VALUES (?, ?, ?, ?, ?)`
      ).bind(name, email, book || 'Contact Form', msg, 'contact').run();
      // Queue admin notification
      await queueEmail(env, notify, 'Gideon', 'New Contact: ' + name, notifyHtml(name, email, msg, 'contact'), 'admin_notification');
      // Queue manifesto follow-up (day 3) if a book download
      if (book) {
        try {
          const slugMap = { 'The Bible as Kingdom OS': 'the-bible-as-kingdom-os', 'The Divine Algorithm': 'divine-algorithm', 'AI-Powered Strategic Development': 'ai-national-development', '1 Million Coders Manifesto': '1-million-coders-manifesto' };
          const slug = slugMap[book] || 'the-bible-as-kingdom-os';
          await queueEmail(env, email, name, 'Did You Get Your Free Copy?', manifestoFollowup(name, book, email, slug), 'manifesto_followup', daysFromNow(3));
        } catch (_) {}
      }
    }

    return new Response(JSON.stringify({ status: 'ok' }), {
      status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
