function requireConfig(env) {
  if (!env.WHATSAPP_PHONE_NUMBER_ID || !env.WHATSAPP_ACCESS_TOKEN) {
    throw new Error('WhatsApp credentials not configured');
  }
}

async function postMessages(env, body) {
  requireConfig(env);
  var resp;
  try {
    resp = await fetch(`https://graph.facebook.com/v22.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
  } catch (err) {
    throw new Error('WhatsApp request failed: ' + ((err && err.message) || err));
  }
  if (!resp.ok) {
    var detail = await resp.text().catch(function () { return ''; });
    throw new Error('WhatsApp ' + resp.status + ': ' + String(detail).slice(0, 160));
  }
  return resp;
}

export async function sendWhatsApp(env, toPhone, messageText) {
  return postMessages(env, {
    messaging_product: 'whatsapp',
    to: toPhone.replace(/[^0-9]/g, ''),
    type: 'text',
    text: { body: messageText }
  });
}

export async function sendWhatsAppTemplate(env, toPhone, templateName, languageCode, components) {
  var body = {
    messaging_product: 'whatsapp',
    to: toPhone.replace(/[^0-9]/g, ''),
    type: 'template',
    template: { name: templateName, language: { code: languageCode || 'en' } }
  };
  if (components) body.template.components = components;
  return postMessages(env, body);
}

export async function queueWhatsApp(env, toPhone, messageText, msgType, scheduledAt) {
  if (!env.DB) return;
  var now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  var sendAt = scheduledAt || now;
  await env.DB.prepare(
    'INSERT INTO whatsapp_queue (to_phone, message_text, msg_type, scheduled_at, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(toPhone, messageText, msgType || 'text', sendAt, now).run();
}
