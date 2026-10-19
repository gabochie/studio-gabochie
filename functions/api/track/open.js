/**
 * Open Tracking Pixel Endpoint
 * GET /api/track/open?mid=123&cid=email@example.com
 * Returns 1x1 transparent GIF
 */
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  const messageId = url.searchParams.get('mid');
  const contactEmail = url.searchParams.get('cid');

  if (!messageId || !contactEmail) {
    return new Response(null, { status: 400 });
  }

  try {
    // Record open event
    await env.DB.prepare(
      `UPDATE email_queue 
       SET opened_at = COALESCE(opened_at, datetime('now')), updated_at = datetime('now')
       WHERE id = ? AND to_email = ?`
    ).bind(messageId, contactEmail).run();

    // Log tracking event (contact resolved from outreach OR subscribers)
    await env.DB.prepare(
      `INSERT INTO tracking_events (message_id, contact_id, event_type, event_data, created_at)
       VALUES (?, COALESCE((SELECT id FROM cold_outreach WHERE email = ? LIMIT 1), (SELECT id FROM subscribers WHERE email = ? LIMIT 1)), 'open', ?, datetime('now'))`
    ).bind(messageId, contactEmail, contactEmail, JSON.stringify({ userAgent: request.headers.get('User-Agent') })).run();

  } catch (err) {
    console.error('Open tracking error:', err);
  }

  // Return 1x1 transparent GIF
  const gif = new Uint8Array([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
    0x00, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0xFF, 0x21, 0xF9, 0x04, 0x01, 0x00,
    0x00, 0x00, 0x00, 0x2C, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
    0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3B
  ]);

  return new Response(gif, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Access-Control-Allow-Origin': '*'
    }
  });
}