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
      `CREATE INDEX IF NOT EXISTS idx_page_views_viewed_at ON page_views(viewed_at)`,
      `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT (datetime('now')))`,
      `INSERT OR IGNORE INTO settings (key, value) VALUES ('coming_soon', 'false')`,
      // Migrations
      `ALTER TABLE page_views ADD COLUMN country TEXT DEFAULT ''`,
      `ALTER TABLE page_views ADD COLUMN city TEXT DEFAULT ''`,
      `ALTER TABLE page_views ADD COLUMN ip TEXT DEFAULT ''`,
      `ALTER TABLE subscribers ADD COLUMN ref_code TEXT DEFAULT ''`,
      `ALTER TABLE subscribers ADD COLUMN edition TEXT DEFAULT ''`,
      `ALTER TABLE subscribers ADD COLUMN confirmed INTEGER DEFAULT 0`,
      `ALTER TABLE subscribers ADD COLUMN brevo_id TEXT DEFAULT ''`,
      `ALTER TABLE donations ADD COLUMN donor_phone TEXT DEFAULT ''`,
      `CREATE TABLE IF NOT EXISTS referrals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        referrer_code TEXT NOT NULL,
        referred_name TEXT DEFAULT '',
        referred_email TEXT NOT NULL,
        referred_country TEXT DEFAULT '',
        referred_at TEXT NOT NULL DEFAULT (datetime('now')),
        reward_claimed INTEGER DEFAULT 0,
        reward_tier TEXT DEFAULT '',
        UNIQUE(referrer_code, referred_email)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referrer_code)`,
      `CREATE INDEX IF NOT EXISTS idx_referrals_reward ON referrals(reward_claimed)`,
      // School programs
      `CREATE TABLE IF NOT EXISTS programs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        tagline TEXT DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        duration TEXT NOT NULL DEFAULT 'Self-paced',
        price REAL DEFAULT 0,
        price_label TEXT DEFAULT 'Free',
        status TEXT NOT NULL DEFAULT 'active',
        sample_content TEXT DEFAULT '',
        sort_order INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS enrollments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        program_id INTEGER NOT NULL,
        student_name TEXT NOT NULL,
        student_email TEXT NOT NULL,
        student_phone TEXT DEFAULT '',
        access_token TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'pending',
        payment_ref TEXT DEFAULT '',
        payment_amount REAL DEFAULT 0,
        enrolled_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (program_id) REFERENCES programs(id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_enrollments_email ON enrollments(student_email)`,
      `CREATE INDEX IF NOT EXISTS idx_enrollments_token ON enrollments(access_token)`,
      `CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(status)`,
      `CREATE INDEX IF NOT EXISTS idx_programs_slug ON programs(slug)`,
      `INSERT OR IGNORE INTO programs (title, slug, tagline, description, duration, price, price_label, status, sample_content, sort_order) VALUES ('Systems Thinking Program', 'systems-thinking', 'See the whole. Solve the root. Design the future.', 'Understand the hidden patterns that shape our world. This program teaches you to see interconnected systems, anticipate ripple effects, and design solutions that actually work - whether in business, society, or your personal life. Through case studies, mental models, and practical exercises, you will develop the lens of a systems thinker.', 'Self-paced', 250, 'Free Sample · Full Access GH¢ 250', 'active', '<h2>Welcome to the Systems Thinking Program</h2><p>Before we dive into the models, let us start with a simple exercise. Look around you right now. Pick one problem - in your work, your community, or your life - and ask: <em>What keeps this problem in place?</em></p><p>That is the first step. Systems thinking begins not with answers, but with better questions.</p><h3>Your First Tool: The Iceberg Model</h3><p>Most people react to events. Systems thinkers look deeper:</p><ul><li><strong>Events</strong> - What happened? (the tip)</li><li><strong>Patterns</strong> - What has been happening over time?</li><li><strong>Structure</strong> - What forces are driving these patterns?</li><li><strong>Mental Models</strong> - What beliefs keep this structure in place?</li></ul><p>For the full program, you will get video walkthroughs, real-world case studies, worksheets, and community exercises.</p>', 1), ('Architectural Thinking Program', 'architectural-thinking', 'Coming Soon', 'Learn to think like an architect - structuring ideas, projects, and systems with clarity and purpose. This program covers mental models, design principles, and strategic frameworks for building anything that matters. From blueprints to execution, you will learn how to design solutions that stand the test of time.', 'Self-paced', 0, 'Coming Soon', 'coming_soon', '', 2)`
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
