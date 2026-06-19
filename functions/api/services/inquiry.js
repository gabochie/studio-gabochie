import { queueEmail } from '../email/_send.js';

const notifyHtml = (service, name, email, phone, company, budget, timeline, description, referral) => `<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#FAFAFA;padding:20px">
  <h2 style="color:#0A1628">New Service Inquiry: ${service}</h2>
  <table style="font-family:Georgia,serif;font-size:15px;color:#6B7F9A;border-collapse:collapse;width:100%">
    <tr><td style="padding:8px 12px;border:1px solid #E2E6ED;font-weight:700;width:120px">Service:</td><td style="padding:8px 12px;border:1px solid #E2E6ED">${service}</td></tr>
    <tr><td style="padding:8px 12px;border:1px solid #E2E6ED;font-weight:700">Name:</td><td style="padding:8px 12px;border:1px solid #E2E6ED">${name}</td></tr>
    <tr><td style="padding:8px 12px;border:1px solid #E2E6ED;font-weight:700">Email:</td><td style="padding:8px 12px;border:1px solid #E2E6ED">${email}</td></tr>
    <tr><td style="padding:8px 12px;border:1px solid #E2E6ED;font-weight:700">Phone:</td><td style="padding:8px 12px;border:1px solid #E2E6ED">${phone || '—'}</td></tr>
    <tr><td style="padding:8px 12px;border:1px solid #E2E6ED;font-weight:700">Company:</td><td style="padding:8px 12px;border:1px solid #E2E6ED">${company || '—'}</td></tr>
    <tr><td style="padding:8px 12px;border:1px solid #E2E6ED;font-weight:700">Budget:</td><td style="padding:8px 12px;border:1px solid #E2E6ED">${budget || '—'}</td></tr>
    <tr><td style="padding:8px 12px;border:1px solid #E2E6ED;font-weight:700">Timeline:</td><td style="padding:8px 12px;border:1px solid #E2E6ED">${timeline || '—'}</td></tr>
    <tr><td style="padding:8px 12px;border:1px solid #E2E6ED;font-weight:700">Referral:</td><td style="padding:8px 12px;border:1px solid #E2E6ED">${referral || '—'}</td></tr>
    ${description ? `<tr><td style="padding:8px 12px;border:1px solid #E2E6ED;font-weight:700">Description:</td><td style="padding:8px 12px;border:1px solid #E2E6ED">${description}</td></tr>` : ''}
  </table>
  <p style="font-size:12px;color:#94A3B8;margin-top:16px"><a href="https://gideonabochie.org/admin/services.html">Manage Inquiries</a></p></body></html>`;

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', 'Allow': 'POST' }
    });
  }
  try {
    const formData = await request.formData();
    const service = formData.get('service') || '';
    const name = formData.get('name') || '';
    const email = formData.get('email') || '';
    const phone = formData.get('phone') || '';
    const company = formData.get('company') || '';
    const budget = formData.get('budget') || '';
    const timeline = formData.get('timeline') || '';
    const description = formData.get('description') || '';
    const referral = formData.get('referral') || '';
    const spam = formData.get('_gotcha');
    if (spam) {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    if (!service || !name || !email) {
      return new Response(JSON.stringify({ status: 'error', message: 'Service, name, and email are required.' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    const db = env.DB;
    const notify = env.NOTIFY_EMAIL || 'gid@gideonabochie.com';
    if (db) {
      await db.prepare(
        `INSERT INTO service_inquiries (service, name, email, phone, company, budget, timeline, description, referral, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')`
      ).bind(service, name, email, phone, company, budget, timeline, description, referral).run();
      await queueEmail(env, notify, 'Gideon', 'Service Inquiry: ' + name + ' - ' + service, notifyHtml(service, name, email, phone, company, budget, timeline, description, referral), 'admin_notification');
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
