import { requireAdminAuth } from './admin/_admin-auth.js';

var corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key' };

export async function onRequest(context) {
  var { request, env } = context;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'POST required' }), { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  var authError = await requireAdminAuth(request, env);
  if (authError) return authError;

  try {
    var body = await request.json();
    var to = body.to || '';
    var message = body.message || '';
    if (!to || !message) return new Response(JSON.stringify({ error: 'to and message required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    // Send directly via Meta API (bypasses queue for instant delivery)
    if (!env.WHATSAPP_PHONE_NUMBER_ID || !env.WHATSAPP_ACCESS_TOKEN) {
      return new Response(JSON.stringify({ error: 'WhatsApp not configured. Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN env vars.' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    var resp = await fetch(`https://graph.facebook.com/v22.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to.replace(/[^0-9]/g, ''),
        type: 'text',
        text: { body: message }
      })
    });

    var respData = await resp.text();
    var parsed = {};
    try { parsed = JSON.parse(respData); } catch (_) {}

    return new Response(JSON.stringify({
      status: resp.ok ? 'ok' : 'error',
      metaStatus: resp.status,
      metaResponse: parsed.error ? parsed.error.message : respData
    }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}
