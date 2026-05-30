export async function checkRateLimit(db, ip, endpoint, maxRequests, windowSeconds) {
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
  } catch (_) {
    return true;
  }
}
