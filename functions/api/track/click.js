/**
 * Click Tracking Redirect Endpoint
 * GET /api/track/click?url=...&mid=123&cid=email@example.com
 * Records click, then 302 redirects to destination
 */
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  const destination = url.searchParams.get('url');
  const messageId = url.searchParams.get('mid');
  const contactEmail = url.searchParams.get('cid');

  if (!destination || !messageId || !contactEmail) {
    return new Response('Missing parameters', { status: 400 });
  }

  // Validate destination URL
  let destUrl;
  try {
    destUrl = new URL(decodeURIComponent(destination));
    // Only allow http/https
    if (!['http:', 'https:'].includes(destUrl.protocol)) {
      throw new Error('Invalid protocol');
    }
  } catch (err) {
    return new Response('Invalid destination URL', { status: 400 });
  }

  try {
    // Record click event
    await env.DB.prepare(
      `UPDATE email_queue 
       SET clicked_at = COALESCE(clicked_at, datetime('now')), updated_at = datetime('now')
       WHERE id = ? AND to_email = ?`
    ).bind(messageId, contactEmail).run();

    // Log tracking event (contact resolved from outreach OR subscribers)
    await env.DB.prepare(
      `INSERT INTO tracking_events (message_id, contact_id, event_type, event_data, created_at)
       VALUES (?, COALESCE((SELECT id FROM cold_outreach WHERE email = ? LIMIT 1), (SELECT id FROM subscribers WHERE email = ? LIMIT 1)), 'click', ?, datetime('now'))`
    ).bind(messageId, contactEmail, contactEmail, JSON.stringify({ 
      destination: destination,
      userAgent: request.headers.get('User-Agent')
    })).run();

  } catch (err) {
    console.error('Click tracking error:', err);
  }

  // Redirect to destination
  return new Response(null, {
    status: 302,
    headers: {
      'Location': destination,
      'Cache-Control': 'no-store'
    }
  });
}