var corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };

export async function onRequest(context) {
  var { request, env } = context;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  var url = new URL(request.url);

  if (request.method === 'GET') {
    return new Response(JSON.stringify({ status: 'ok', message: 'wapi is live', hasNumberId: !!env.WHATSAPP_PHONE_NUMBER_ID, hasToken: !!env.WHATSAPP_ACCESS_TOKEN }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  try {
    var body = await request.json();
    var to = body.to || '';
    var message = body.message || '';

    if (!to || !message) {
      return new Response(JSON.stringify({ error: 'to and message required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

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
    return new Response(JSON.stringify({ status: resp.ok ? 'ok' : 'error', metaStatus: resp.status, metaResponse: respData }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}
