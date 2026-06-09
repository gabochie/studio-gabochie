CREATE TABLE IF NOT EXISTS subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT '',
  book TEXT DEFAULT '',
  subscribed_at TEXT NOT NULL DEFAULT (datetime('now')),
  metadata TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS donations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tx_ref TEXT NOT NULL UNIQUE,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GHS',
  donor_name TEXT DEFAULT '',
  donor_email TEXT DEFAULT '',
  donor_phone TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  flw_id TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  metadata TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT DEFAULT '',
  ad_type TEXT NOT NULL DEFAULT '',
  message TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  payment_tx_ref TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS page_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page TEXT NOT NULL,
  referrer TEXT DEFAULT '',
  country TEXT DEFAULT '',
  city TEXT DEFAULT '',
  ip TEXT DEFAULT '',
  viewed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS testimonials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author TEXT NOT NULL,
  role TEXT DEFAULT '',
  content TEXT NOT NULL,
  rating INTEGER DEFAULT 5,
  active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  icon TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS gallery (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  image_url TEXT NOT NULL,
  category TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);
CREATE INDEX IF NOT EXISTS idx_donations_tx_ref ON donations(tx_ref);
CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);
CREATE INDEX IF NOT EXISTS idx_bookings_email ON bookings(email);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_testimonials_active ON testimonials(active);
CREATE INDEX IF NOT EXISTS idx_stats_active ON stats(active);
CREATE INDEX IF NOT EXISTS idx_gallery_active ON gallery(active);
CREATE INDEX IF NOT EXISTS idx_page_views_page ON page_views(page);
CREATE INDEX IF NOT EXISTS idx_page_views_viewed_at ON page_views(viewed_at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO settings (key, value) VALUES ('coming_soon', 'false');

CREATE TABLE IF NOT EXISTS referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_code TEXT NOT NULL,
  referred_name TEXT DEFAULT '',
  referred_email TEXT NOT NULL,
  referred_country TEXT DEFAULT '',
  referred_at TEXT NOT NULL DEFAULT (datetime('now')),
  reward_claimed INTEGER DEFAULT 0,
  reward_tier TEXT DEFAULT '',
  UNIQUE(referrer_code, referred_email)
);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referrer_code);
CREATE INDEX IF NOT EXISTS idx_referrals_reward ON referrals(reward_claimed);

CREATE TABLE IF NOT EXISTS programs (
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
);

CREATE TABLE IF NOT EXISTS enrollments (
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
);

CREATE INDEX IF NOT EXISTS idx_enrollments_email ON enrollments(student_email);
CREATE INDEX IF NOT EXISTS idx_enrollments_token ON enrollments(access_token);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(status);
CREATE INDEX IF NOT EXISTS idx_programs_slug ON programs(slug);

INSERT OR IGNORE INTO programs (title, slug, tagline, description, duration, price, price_label, status, sample_content, sort_order) VALUES
('Gideon Guitar Method', 'guitar-method', 'Learn to play your favorite Ghanaian songs on guitar.', 'The fastest path from zero to your first Ghanaian song. 16 modules, 64 video lessons, real-time pitch detection, deliberate practice system built on peer-reviewed learning science. Start with bronze modules free, unlock silver and gold for full access.', 'Self-paced', 250, 'Free Sample &middot; Full Access GH&cent; 250', 'active', '<h2>Welcome to the Gideon Guitar Method</h2><p>This program teaches you to play guitar using deliberate practice. You will learn Ghanaian songs and build real musical ability, not just memorised patterns.</p><p><strong>Bronze tier (free sample):</strong> Modules 1-5 covering the foundation — parts of the guitar, open chords, strumming, and the one-minute changes drill.</p><p><strong>Silver &amp; Gold tiers (full access):</strong> Modules 6-16 covering songcraft, Ghanaian highlife techniques, barre chords, fingerpicking, and performance-ready skills.</p><p>Visit <a href=&quot;/school/guitar/&quot;>the program page</a> to start learning.</p>', 0),
('Systems Thinking Program', 'systems-thinking', 'See the whole. Solve the root. Design the future.', 'Understand the hidden patterns that shape our world. This program teaches you to see interconnected systems, anticipate ripple effects, and design solutions that actually work — whether in business, society, or your personal life. Through case studies, mental models, and practical exercises, you''ll develop the lens of a systems thinker.', 'Self-paced', 250, 'Free Sample · Full Access GH¢ 250', 'active', '<h2>Welcome to the Systems Thinking Program</h2><p>Before we dive into the models, let''s start with a simple exercise. Look around you right now. Pick one problem — in your work, your community, or your life — and ask: <em>What keeps this problem in place?</em></p><p>That''s the first step. Systems thinking begins not with answers, but with better questions.</p><h3>Your First Tool: The Iceberg Model</h3><p>Most people react to events. Systems thinkers look deeper:</p><ul><li><strong>Events</strong> — What happened? (the tip)</li><li><strong>Patterns</strong> — What''s been happening over time?</li><li><strong>Structure</strong> — What forces are driving these patterns?</li><li><strong>Mental Models</strong> — What beliefs keep this structure in place?</li></ul><p>For the full program, you''ll get video walkthroughs, real-world case studies, worksheets, and community exercises.</p>', 1),
('Architectural Thinking Program', 'architectural-thinking', 'Coming Soon', 'Learn to think like an architect — structuring ideas, projects, and systems with clarity and purpose. This program covers mental models, design principles, and strategic frameworks for building anything that matters. From blueprints to execution, you''ll learn how to design solutions that stand the test of time.', 'Self-paced', 0, 'Coming Soon', 'coming_soon', '', 2);

-- Migrate existing page_views table (safe to run even if columns already exist)
ALTER TABLE page_views ADD COLUMN country TEXT DEFAULT '';
ALTER TABLE page_views ADD COLUMN city TEXT DEFAULT '';
ALTER TABLE page_views ADD COLUMN ip TEXT DEFAULT '';
ALTER TABLE subscribers ADD COLUMN ref_code TEXT DEFAULT '';
ALTER TABLE subscribers ADD COLUMN edition TEXT DEFAULT '';
ALTER TABLE subscribers ADD COLUMN confirmed INTEGER DEFAULT 0;
ALTER TABLE subscribers ADD COLUMN brevo_id TEXT DEFAULT '';
ALTER TABLE donations ADD COLUMN donor_phone TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS cold_outreach (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  website TEXT DEFAULT '',
  address TEXT DEFAULT '',
  category TEXT DEFAULT '',
  source TEXT DEFAULT '',
  region TEXT DEFAULT '',
  country TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  campaign TEXT DEFAULT '',
  contacted_at TEXT DEFAULT '',
  response TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  imported_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cold_outreach_email ON cold_outreach(email);
CREATE INDEX IF NOT EXISTS idx_cold_outreach_phone ON cold_outreach(phone);
CREATE INDEX IF NOT EXISTS idx_cold_outreach_status ON cold_outreach(status);
CREATE INDEX IF NOT EXISTS idx_cold_outreach_category ON cold_outreach(category);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  phase INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  source TEXT NOT NULL DEFAULT 'manual',
  priority TEXT NOT NULL DEFAULT 'medium',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_source ON tasks(source);
