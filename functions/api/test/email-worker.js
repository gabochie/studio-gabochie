export async function onRequest(context) {
  const { env } = context;
  
  if (!env.BREVO_API_KEY) {
    return new Response(JSON.stringify({ error: 'BREVO_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const DAILY_LIMIT = 300;
  const BATCH_SIZE = 50;

  try {
    const today = new Date().toISOString().split('T')[0];
    const countResult = await env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM email_queue 
       WHERE sent_at LIKE ? AND status = 'sent'`
    ).bind(`${today}%`).first();

    const sentToday = countResult?.cnt || 0;
    if (sentToday >= DAILY_LIMIT) {
      return new Response(JSON.stringify({ error: `Daily limit reached (${sentToday}/${DAILY_LIMIT})` }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const remainingToday = DAILY_LIMIT - sentToday;
    const limit = Math.min(BATCH_SIZE, remainingToday);

    const now = new Date().toISOString();
    const pending = await env.DB.prepare(
      `SELECT * FROM email_queue 
       WHERE status = 'pending' 
       AND scheduled_at <= ?
       AND to_email NOT IN (SELECT email FROM suppression_list)
       ORDER BY scheduled_at ASC
       LIMIT ?`
    ).bind(now, limit).all();

    if (!pending.results || pending.results.length === 0) {
      return new Response(JSON.stringify({ message: 'No pending emails to send' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const results = [];
    for (const email of pending.results) {
      const result = await processEmail(email, env);
      results.push(result);
      await new Promise(r => setTimeout(r, 100));
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function processEmail(email, env) {
  const id = email.id;

  try {
    await env.DB.prepare(
      `UPDATE email_queue SET status = 'sending', updated_at = datetime('now') WHERE id = ?`
    ).bind(id).run();

    const baseUrl = env.PUBLIC_BASE_URL || 'https://studio.gabochie.com';
    const trackingPixel = `<img src="${baseUrl}/api/track/open?mid=${id}&cid=${encodeURIComponent(email.to_email)}" width="1" height="1" alt="" style="display:none">`;
    
    const htmlWithTracking = email.html_content.replace('</body>', `${trackingPixel}</body>`);

    const clickTrackedHtml = rewriteLinksForTracking(htmlWithTracking, baseUrl, id, email.to_email);

    const payload = {
      sender: {
        email: 'studio@gabochie.com',
        name: 'Studio Gabochie'
      },
      to: [{ email: email.to_email, name: email.to_name || '' }],
      subject: email.subject,
      htmlContent: clickTrackedHtml,
      textContent: stripHtml(clickTrackedHtml),
      tags: [email.email_type || 'manual'],
      headers: {
        'X-Message-ID': String(id),
        'X-Contact-Email': email.to_email
      }
    };

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': env.BREVO_API_KEY
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`Brevo API error: ${result.message || response.statusText}`);
    }

    await env.DB.prepare(
      `UPDATE email_queue 
       SET status = 'sent', sent_at = datetime('now'), provider_id = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).bind(result.messageId, id).run();

    return { id, to_email: email.to_email, status: 'sent', provider_id: result.messageId };

  } catch (err) {
    const retryCount = (email.retry_count || 0) + 1;
    const maxRetries = 3;

    if (retryCount >= maxRetries) {
      await env.DB.prepare(
        `UPDATE email_queue 
         SET status = 'failed', retry_count = ?, last_error = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).bind(retryCount, err.message, id).run();
      return { id, to_email: email.to_email, status: 'failed', error: err.message };
    } else {
      await env.DB.prepare(
        `UPDATE email_queue 
         SET status = 'pending', retry_count = ?, last_error = ?, 
             scheduled_at = datetime('now', '+' || ? || ' minutes'), updated_at = datetime('now')
         WHERE id = ?`
      ).bind(retryCount, err.message, retryCount * 5, id).run();
      return { id, to_email: email.to_email, status: 'retry', error: err.message };
    }
  }
}

function rewriteLinksForTracking(html, baseUrl, messageId, contactEmail) {
  return html.replace(
    /href=["'](https?:\/\/[^"']+)["']/gi,
    (match, url) => {
      if (url.includes('/api/track/') || url.includes('/unsubscribe')) return match;
      const tracked = `${baseUrl}/api/track/click?url=${encodeURIComponent(url)}&mid=${messageId}&cid=${encodeURIComponent(contactEmail)}`;
      return `href="${tracked}"`;
    }
  );
}

function stripHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}