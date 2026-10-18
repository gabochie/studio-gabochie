/**
 * Brevo Webhook Handler
 * POST /api/webhooks/brevo
 * Handles: delivered, hard_bounce, soft_bounce, spam_complaint, unsubscribe
 */
export async function onRequest(context) {
  const { request, env } = context;

  // Verify webhook signature (Brevo sends X-Mailin-Signature header)
  const signature = request.headers.get('X-Mailin-Signature');
  const secret = env.BREVO_WEBHOOK_SECRET || env.BREVO_API_KEY;
  
  if (secret && signature) {
    const body = await request.clone().text();
    const valid = await verifyBrevoSignature(body, signature, secret);
    if (!valid) {
      console.warn('Invalid Brevo webhook signature');
      return new Response('Invalid signature', { status: 401 });
    }
  }

  let events;
  try {
    events = await request.json();
  } catch (err) {
    return new Response('Invalid JSON', { status: 400 });
  }

  // Brevo sends array of events
  const eventList = Array.isArray(events) ? events : [events];

  for (const event of eventList) {
    await processBrevoEvent(event, env);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function verifyBrevoSignature(payload, signature, secret) {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    const sigBuffer = hexToBuffer(signature);
    const data = encoder.encode(payload);
    
    return await crypto.subtle.verify('HMAC', key, sigBuffer, data);
  } catch (err) {
    console.error('Signature verification error:', err);
    return false;
  }
}

function hexToBuffer(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes.buffer;
}

async function processBrevoEvent(event, env) {
  const { type, email, message_id, tag, timestamp } = event;
  
  // Extract our message ID from tag or X-Message-ID header equivalent
  // Brevo includes tags array; we stored our message ID as a tag
  let ourMessageId = null;
  if (Array.isArray(tag)) {
    ourMessageId = tag.find(t => t.startsWith('msg_'))?.replace('msg_', '');
  }

  console.log(`Brevo webhook: ${type} for ${email} (msg: ${ourMessageId})`);

  try {
    switch (type) {
      case 'delivered':
        if (ourMessageId) {
          await env.DB.prepare(
            `UPDATE email_queue SET status = 'delivered', updated_at = datetime('now')
             WHERE id = ?`
          ).bind(ourMessageId).run();
        }
        break;

      case 'hard_bounce':
        if (ourMessageId) {
          await env.DB.prepare(
            `UPDATE email_queue SET status = 'bounced', last_error = 'Hard bounce', updated_at = datetime('now')
             WHERE id = ?`
          ).bind(ourMessageId).run();
        }
        // Add to suppression list
        await env.DB.prepare(
          `INSERT OR REPLACE INTO suppression_list (email, reason, created_at)
           VALUES (?, 'bounce', datetime('now'))`
        ).bind(email).run();
        break;

      case 'soft_bounce':
        if (ourMessageId) {
          await env.DB.prepare(
            `UPDATE email_queue SET status = 'soft_bounced', last_error = 'Soft bounce', updated_at = datetime('now')
             WHERE id = ?`
          ).bind(ourMessageId).run();
        }
        break;

      case 'spam_complaint':
        // Add to suppression list immediately
        await env.DB.prepare(
          `INSERT OR REPLACE INTO suppression_list (email, reason, created_at)
           VALUES (?, 'complaint', datetime('now'))`
        ).bind(email).run();
        
        if (ourMessageId) {
          await env.DB.prepare(
            `UPDATE email_queue SET status = 'complained', updated_at = datetime('now')
             WHERE id = ?`
          ).bind(ourMessageId).run();
        }
        break;

      case 'unsubscribe':
        // Already handled by our /unsubscribe endpoint, but sync here too
        await env.DB.prepare(
          `INSERT OR REPLACE INTO suppression_list (email, reason, created_at)
           VALUES (?, 'unsubscribe', datetime('now'))`
        ).bind(email).run();
        
        if (ourMessageId) {
          await env.DB.prepare(
            `UPDATE email_queue SET status = 'unsubscribed', updated_at = datetime('now')
             WHERE id = ?`
          ).bind(ourMessageId).run();
        }
        
        await env.DB.prepare(
          `UPDATE cold_outreach SET status = 'unsubscribed', updated_at = datetime('now')
           WHERE email = ?`
        ).bind(email).run();
        break;

      case 'opened':
      case 'click':
        // These are tracked via our own pixel/click endpoints
        // Brevo also sends them but we already track
        break;
    }
  } catch (err) {
    console.error('Brevo webhook processing error:', err);
  }
}