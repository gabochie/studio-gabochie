import { queueEmail } from './email/_send.js';

const notifyHtml = (name, email, phone, company, slot, msg) => `<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#FAFAFA;padding:20px">
  <h2 style="color:#0A1628">New Ad Booking Inquiry</h2>
  <table style="font-family:Georgia,serif;font-size:15px;color:#6B7F9A;border-collapse:collapse;width:100%">
    <tr><td style="padding:8px 12px;border:1px solid #E2E6ED;font-weight:700;width:100px">Name:</td><td style="padding:8px 12px;border:1px solid #E2E6ED">${name}</td></tr>
    <tr><td style="padding:8px 12px;border:1px solid #E2E6ED;font-weight:700">Email:</td><td style="padding:8px 12px;border:1px solid #E2E6ED">${email}</td></tr>
    <tr><td style="padding:8px 12px;border:1px solid #E2E6ED;font-weight:700">Phone:</td><td style="padding:8px 12px;border:1px solid #E2E6ED">${phone}</td></tr>
    <tr><td style="padding:8px 12px;border:1px solid #E2E6ED;font-weight:700">Company:</td><td style="padding:8px 12px;border:1px solid #E2E6ED">${company}</td></tr>
    <tr><td style="padding:8px 12px;border:1px solid #E2E6ED;font-weight:700">Slot:</td><td style="padding:8px 12px;border:1px solid #E2E6ED">${slot}</td></tr>
    ${msg ? `<tr><td style="padding:8px 12px;border:1px solid #E2E6ED;font-weight:700">Message:</td><td style="padding:8px 12px;border:1px solid #E2E6ED">${msg}</td></tr>` : ''}
  </table>
  <p style="font-size:12px;color:#94A3B8;margin-top:16px"><a href="https://studio.gabochie.com/admin/agents.html">Go to Command Center</a></p></body></html>`;

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', 'Allow': 'POST' }
    });
  }
  try {
    const formData = await request.formData();
    const name = formData.get('name') || '';
    const email = formData.get('email') || '';
    const phone = formData.get('phone') || '';
    const company = formData.get('company') || '';
    const slot = formData.get('slot') || '';
    const message = formData.get('message') || '';
    const spam = formData.get('_gotcha');
    if (spam) {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    const tx_ref = formData.get('tx_ref') || '';
    const amount = parseFloat(formData.get('amount')) || 0;
    const db = env.DB;
    const notify = env.NOTIFY_EMAIL || 'gid@gabochie.com';
    if (db && email) {
      await db.prepare(
        `INSERT INTO bookings (name, email, company, ad_type, message, status, payment_tx_ref, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(name, email, company, slot, message, tx_ref ? 'paid' : 'pending', tx_ref, amount).run();
      // Store in contact_submissions for admin review
      await db.prepare(
        `INSERT INTO contact_submissions (name, email, subject, message, source) VALUES (?, ?, ?, ?, ?)`
      ).bind(name, email, 'Ad Booking: ' + slot, message, 'booking').run();
      // Queue admin notification
      await queueEmail(env, notify, 'Gideon', 'Booking Inquiry: ' + name + ' - ' + slot, notifyHtml(name, email, phone, company, slot, message), 'admin_notification');
    }

    return new Response(JSON.stringify({ status: 'ok' }), {
      status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
