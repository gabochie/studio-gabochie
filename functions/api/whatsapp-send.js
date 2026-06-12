import { sendWhatsApp, queueWhatsApp } from './whatsapp/_send.js';

var corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key' };

export async function onRequest(context) {
  var { request, env } = context;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'POST required' }), { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  try {
    var body = await request.json();
    var to = body.to || '';
    var message = body.message || '';
    if (!to || !message) return new Response(JSON.stringify({ error: 'to and message required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    await queueWhatsApp(env, to, message, 'manual');
    return new Response(JSON.stringify({ status: 'ok', message: 'WhatsApp message queued', to: to }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}
