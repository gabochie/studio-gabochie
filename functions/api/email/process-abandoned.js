import { queueEmail, abandonedDonationReminder, daysFromNow } from './_send.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    const { results } = await env.DB.prepare(
      `SELECT DISTINCT e.email, e.event_data
       FROM events e
       WHERE e.event_type = 'donation_started'
         AND e.email != ''
         AND e.created_at <= datetime('now', '-24 hours')
         AND NOT EXISTS (SELECT 1 FROM donations d WHERE d.donor_email = e.email AND d.status = 'completed')
         AND NOT EXISTS (SELECT 1 FROM email_queue q WHERE q.to_email = e.email AND q.email_type = 'abandoned_donation')
       ORDER BY e.created_at ASC`
    ).all();

    let queued = 0;
    for (const row of results) {
      let name = '';
      try { const d = JSON.parse(row.event_data); name = d.name || ''; } catch (_) {}
      await queueEmail(env, row.email, name, 'You Were About to Make a Difference — Studio by Gabochie', abandonedDonationReminder(name), 'abandoned_donation', daysFromNow(0));
      queued++;
    }

    return new Response(JSON.stringify({ status: 'ok', checked: results.length, queued }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
