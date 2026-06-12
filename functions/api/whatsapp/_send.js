export async function sendWhatsApp(env, toPhone, messageText) {
  if (!env.WHATSAPP_PHONE_NUMBER_ID || !env.WHATSAPP_ACCESS_TOKEN) return;
  try {
    await fetch(`https://graph.facebook.com/v22.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toPhone.replace(/[^0-9]/g, ''),
        type: 'text',
        text: { body: messageText }
      })
    });
  } catch (_) {}
}

export async function sendWhatsAppTemplate(env, toPhone, templateName, languageCode, components) {
  if (!env.WHATSAPP_PHONE_NUMBER_ID || !env.WHATSAPP_ACCESS_TOKEN) return;
  try {
    var body = {
      messaging_product: 'whatsapp',
      to: toPhone.replace(/[^0-9]/g, ''),
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode || 'en' }
      }
    };
    if (components) body.template.components = components;
    await fetch(`https://graph.facebook.com/v22.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
  } catch (_) {}
}

export async function queueWhatsApp(env, toPhone, messageText, msgType, scheduledAt) {
  if (!env.DB) return;
  var now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  var sendAt = scheduledAt || now;
  await env.DB.prepare(
    'INSERT INTO whatsapp_queue (to_phone, message_text, msg_type, scheduled_at, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(toPhone, messageText, msgType || 'text', sendAt, now).run();
}
