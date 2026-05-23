export async function onRequest(context) {
  const db = context.env.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    const statements = [
      `CREATE TABLE IF NOT EXISTS subscribers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL UNIQUE,
        source TEXT NOT NULL DEFAULT '',
        book TEXT DEFAULT '',
        subscribed_at TEXT NOT NULL DEFAULT (datetime('now')),
        metadata TEXT DEFAULT '{}'
      )`,
      `CREATE TABLE IF NOT EXISTS donations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tx_ref TEXT NOT NULL UNIQUE,
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'GHS',
        donor_name TEXT DEFAULT '',
        donor_email TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        flw_id TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        metadata TEXT DEFAULT '{}'
      )`,
      `CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        company TEXT DEFAULT '',
        ad_type TEXT NOT NULL DEFAULT '',
        message TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        payment_tx_ref TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS page_views (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        page TEXT NOT NULL,
        referrer TEXT DEFAULT '',
        viewed_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS testimonials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        author TEXT NOT NULL,
        role TEXT DEFAULT '',
        content TEXT NOT NULL,
        rating INTEGER DEFAULT 5,
        active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        label TEXT NOT NULL,
        value TEXT NOT NULL,
        icon TEXT DEFAULT '',
        sort_order INTEGER DEFAULT 0,
        active INTEGER DEFAULT 1,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS gallery (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        image_url TEXT NOT NULL,
        category TEXT DEFAULT '',
        sort_order INTEGER DEFAULT 0,
        active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email)`,
      `CREATE INDEX IF NOT EXISTS idx_donations_tx_ref ON donations(tx_ref)`,
      `CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status)`,
      `CREATE INDEX IF NOT EXISTS idx_bookings_email ON bookings(email)`,
      `CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)`,
      `CREATE INDEX IF NOT EXISTS idx_testimonials_active ON testimonials(active)`,
      `CREATE INDEX IF NOT EXISTS idx_stats_active ON stats(active)`,
      `CREATE INDEX IF NOT EXISTS idx_gallery_active ON gallery(active)`,
      `CREATE INDEX IF NOT EXISTS idx_page_views_page ON page_views(page)`,
      `CREATE INDEX IF NOT EXISTS idx_page_views_viewed_at ON page_views(viewed_at)`
    ];
    const results = [];
    for (const sql of statements) {
      try {
        await db.prepare(sql).run();
        results.push({ sql: sql.slice(0, 50) + '...', ok: true });
      } catch (e) {
        results.push({ sql: sql.slice(0, 50) + '...', ok: false, error: e.message });
      }
    }
    return new Response(JSON.stringify({ status: 'ok', tables: results.length, results }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
