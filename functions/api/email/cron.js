import { sendBrevoEmail, queueEmail, abandonedDonationReminder, daysFromNow } from './_send.js';
import { sendWhatsApp } from '../_whatsapp.js';

export async function onRequest(context) {
  var { request, env } = context;
  var corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Cron-Secret' };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  var url = new URL(request.url);
  var cronSecret = request.headers.get('X-Cron-Secret') || '';

  if (!env.CRON_SECRET || cronSecret !== env.CRON_SECRET) {
    return new Response(JSON.stringify({ status: 'error', message: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  try {
    var result = { abandoned: { checked: 0, queued: 0 }, process: { sent: 0, pending: 0 }, errors: [] };

    // Step 1: Abandoned donation recovery
    try {
      var { results: abandonedResults } = await env.DB.prepare(
        `SELECT DISTINCT e.email, e.event_data
         FROM events e
         WHERE e.event_type = 'donation_started'
           AND e.email != ''
           AND e.created_at <= datetime('now', '-24 hours')
           AND NOT EXISTS (SELECT 1 FROM donations d WHERE d.donor_email = e.email AND d.status = 'completed')
           AND NOT EXISTS (SELECT 1 FROM email_queue q WHERE q.to_email = e.email AND q.email_type = 'abandoned_donation')
         ORDER BY e.created_at ASC`
      ).all();

      result.abandoned.checked = abandonedResults.length;
      for (var row of abandonedResults) {
        var name = '';
        try { var d = JSON.parse(row.event_data); name = d.name || ''; } catch (_) {}
        await queueEmail(env, row.email, name, 'You Were About to Make a Difference — Studio by Gabochie', abandonedDonationReminder(name), 'abandoned_donation', daysFromNow(0));
        result.abandoned.queued++;
      }
    } catch (err) {
      result.errors.push('abandoned: ' + err.message);
    }

    // Step 2: Process email queue
    try {
      var { results: queueResults } = await env.DB.prepare(
        "SELECT * FROM email_queue WHERE sent_at IS NULL AND scheduled_at <= datetime('now') ORDER BY scheduled_at ASC LIMIT 50"
      ).all();

      for (var q of queueResults) {
        try {
          await sendBrevoEmail(env, q.to_email, q.to_name, q.subject, q.html_content);
          await env.DB.prepare("UPDATE email_queue SET sent_at = datetime('now') WHERE id = ?").bind(q.id).run();
          result.process.sent++;
        } catch (err) {
          result.errors.push('send-' + q.id + ': ' + err.message);
        }
      }
      result.process.pending = queueResults.length - result.process.sent;
    } catch (err) {
      result.errors.push('process: ' + err.message);
    }

    // Step 3: Process WhatsApp queue
    try {
      var { results: waResults } = await env.DB.prepare(
        "SELECT * FROM whatsapp_queue WHERE status = 'pending' AND scheduled_at <= datetime('now') ORDER BY scheduled_at ASC LIMIT 20"
      ).all();
      var waSent = 0;
      for (var wa of waResults) {
        try {
          await sendWhatsApp(env, wa.to_phone, wa.message_text);
          await env.DB.prepare("UPDATE whatsapp_queue SET status = 'sent', sent_at = datetime('now') WHERE id = ?").bind(wa.id).run();
          waSent++;
        } catch (err) {
          await env.DB.prepare("UPDATE whatsapp_queue SET status = 'failed' WHERE id = ?").bind(wa.id).run();
          result.errors.push('whatsapp-' + wa.id + ': ' + err.message);
        }
      }
      result.whatsapp = { sent: waSent, pending: waResults.length - waSent };
    } catch (err) {
      result.errors.push('whatsapp-process: ' + err.message);
    }

    return new Response(JSON.stringify({ status: 'ok', ...result }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
}
