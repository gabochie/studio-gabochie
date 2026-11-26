export async function checkRateLimit(db, ip, endpoint, maxRequests, windowSeconds) {
  // Requests without a D1 binding or client IP (local dev / non-CF proxies)
  // stay on the legacy path. Real query failures below now fail closed, so an
  // unenforceable limit caused by a database outage never admits traffic.
  if (!db || !ip) return true;
  maxRequests = maxRequests || 10;
  windowSeconds = windowSeconds || 60;
  try {
    const result = await db.prepare(
      `SELECT COUNT(*) as cnt FROM events WHERE event_type = ? AND event_data = ? AND created_at > datetime('now', ?)`
    ).bind('rl_' + endpoint, 'ip:' + ip, '-' + windowSeconds + ' seconds').first();
    if (result && result.cnt >= maxRequests) return false;
    await db.prepare(
      `INSERT INTO events (event_type, event_data, page) VALUES (?, ?, ?)`
    ).bind('rl_' + endpoint, 'ip:' + ip, endpoint).run();
    return true;
  } catch (_e) {
    return false;
  }
}
