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
        page TEXT NOT NULL DEFAULT '',
        referrer TEXT DEFAULT '',
        viewed_at TEXT NOT NULL DEFAULT (datetime('now')),
        country TEXT DEFAULT '',
        city TEXT DEFAULT '',
        ip TEXT DEFAULT ''
      )`,
      `CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        event_data TEXT DEFAULT '',
        page TEXT DEFAULT '',
        email TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type)`,
      `CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at)`,
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
      `CREATE TABLE IF NOT EXISTS books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL DEFAULT '',
        price REAL NOT NULL DEFAULT 0,
        file_url TEXT NOT NULL DEFAULT '',
        cover_url TEXT DEFAULT '',
        is_premium INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS book_purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tx_ref TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL DEFAULT '',
        name TEXT NOT NULL DEFAULT '',
        amount REAL NOT NULL DEFAULT 0,
        books_purchased TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        downloaded INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT (datetime('now')))`,
      `INSERT OR IGNORE INTO settings (key, value) VALUES ('coming_soon', 'false')`,
      // ── Cleanup duplicate rows from repeated seed runs ──
      `DELETE FROM testimonials WHERE id NOT IN (SELECT MIN(id) FROM testimonials GROUP BY author, content)`,
      `DELETE FROM stats WHERE id NOT IN (SELECT MIN(id) FROM stats GROUP BY label, value)`,
      `DELETE FROM gallery WHERE id NOT IN (SELECT MIN(id) FROM gallery GROUP BY title, image_url)`,
      // ── Unique indexes so INSERT OR IGNORE prevents future duplicates ──
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_testimonials_unique ON testimonials(author, content)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_stats_unique ON stats(label, value)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_gallery_unique ON gallery(title, image_url)`,
      `INSERT OR IGNORE INTO testimonials (author, role, content, rating) VALUES
        ('Sarah', 'Creative Professional', 'Gideon''s teaching on creativity as worship completely shifted how I see my work. I finally understand that my art is not separate from my faith \u2014 it IS my faith expressed.', 5),
        ('James', 'Bible Study Leader', 'The Bible as Kingdom OS opened my eyes to see Scripture in a whole new way. It''s not just stories \u2014 it''s a living system designed to transform every part of my life.', 5)`,
      `INSERT OR IGNORE INTO stats (label, value, icon, sort_order, active) VALUES
        ('TikTok Followers & Growing', '10000', '📱', 1, 1),
        ('Books Published', '2', '📖', 2, 1),
        ('Daily Video Views', '500', '🎬', 3, 1),
        ('Mission Year', '1', '🌟', 4, 1)`,
      `INSERT OR IGNORE INTO gallery (title, description, image_url, category, sort_order) VALUES
        ('Teaching Session', 'Gideon teaching at a community event', 'assets/images/gallery/teaching-session.jpg', 'events', 1),
        ('Creative Workshop', 'Interactive creative workshop session', 'assets/images/gallery/creative-workshop.jpg', 'events', 2),
        ('Community Outreach', 'Engaging with the local community', 'assets/images/gallery/community-outreach.jpg', 'outreach', 3),
        ('Book Launch', 'Launch event for new publication', 'assets/images/gallery/book-launch.jpg', 'events', 4),
        ('Behind the Scenes', 'Behind the scenes content creation', 'assets/images/gallery/behind-scenes.jpg', 'content', 5),
        ('Ministry Moment', 'A moment of ministry and connection', 'assets/images/gallery/ministry-moment.jpg', 'ministry', 6)`,
      // Migrations
      `ALTER TABLE page_views ADD COLUMN country TEXT DEFAULT ''`,
      `ALTER TABLE page_views ADD COLUMN city TEXT DEFAULT ''`,
      `ALTER TABLE page_views ADD COLUMN ip TEXT DEFAULT ''`,
      `ALTER TABLE subscribers ADD COLUMN ref_code TEXT DEFAULT ''`,
      `ALTER TABLE subscribers ADD COLUMN edition TEXT DEFAULT ''`,
      `ALTER TABLE subscribers ADD COLUMN confirmed INTEGER DEFAULT 0`,
      `ALTER TABLE subscribers ADD COLUMN brevo_id TEXT DEFAULT ''`,
      `ALTER TABLE donations ADD COLUMN donor_phone TEXT DEFAULT ''`,
      `ALTER TABLE bookings ADD COLUMN amount REAL DEFAULT 0`,
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
      // Migrations for programs
      `ALTER TABLE programs ADD COLUMN full_content TEXT DEFAULT ''`,
      `CREATE TABLE IF NOT EXISTS phase_verifications (
        phase INTEGER PRIMARY KEY,
        verified_at TEXT NOT NULL DEFAULT (datetime('now')),
        verified_by TEXT NOT NULL DEFAULT 'admin'
      )`,
      `INSERT OR IGNORE INTO phase_verifications (phase, verified_by) VALUES (1, 'admin')`,
      `INSERT OR IGNORE INTO phase_verifications (phase, verified_by) VALUES (2, 'admin')`,
      `INSERT OR IGNORE INTO phase_verifications (phase, verified_by) VALUES (3, 'admin')`,
      `INSERT OR IGNORE INTO phase_verifications (phase, verified_by) VALUES (5, 'admin')`,
      `INSERT OR IGNORE INTO phase_verifications (phase, verified_by) VALUES (6, 'admin')`,
      `INSERT OR IGNORE INTO phase_verifications (phase, verified_by) VALUES (7, 'admin')`,
      `UPDATE programs SET full_content = '<h2>Module 1: The Iceberg Model</h2><p>Most people react to events. Systems thinkers look deeper. The Iceberg Model is your first tool for seeing below the surface.</p><h3>The Four Levels</h3><p><strong>1. Events</strong> - What happened? The tip of the iceberg. News headlines, daily fires, immediate problems. This is where most people live.</p><p><strong>2. Patterns</strong> - What has been happening over time? Trends, recurring incidents, cycles. Once you see patterns, you can predict.</p><p><strong>3. Structure</strong> - What forces are driving these patterns? Physical infrastructure, rules, resource flows, information flows, feedback loops. Change the structure, change the pattern.</p><p><strong>4. Mental Models</strong> - What beliefs, values, and assumptions keep this structure in place? The deepest level. Paradigms that shape how we see the world.</p><h3>Exercise: Your Iceberg</h3><p>Pick a recurring problem in your life or work. Map it through all four levels of the iceberg. Ask: <em>What event keeps happening? What pattern does it follow? What structure produces that pattern? What mental model keeps that structure alive?</em></p><p>Write your answers in a journal. You will revisit them in Module 4.</p><hr><h2>Module 2: Feedback Loops</h2><p>Systems are not linear. They loop. Feedback loops are the engines of every system - they drive growth, stability, and collapse.</p><h3>Reinforcing Loops</h3><p>Reinforcing loops amplify change. More begets more. Examples: compound interest, viral growth, the arms race, poverty traps. A reinforcing loop can be virtuous (growth) or vicious (decline). Look for the phrase: <em>The more X, the more Y.</em></p><h3>Balancing Loops</h3><p>Balancing loops resist change. They maintain stability or a target state. Examples: thermostat, hunger/satiety, supply/demand, market regulation. A balancing loop always pushes back toward a goal or equilibrium. Look for the phrase: <em>When X gets too high, Y brings it down.</em></p><h3>Case Study: Traffic Congestion</h3><p><strong>Reinforcing:</strong> More cars on the road &rarr; slower traffic &rarr; more people drive alone (avoiding buses stuck in same traffic) &rarr; more cars.<br><strong>Balancing:</strong> Slower traffic &rarr; some people switch to trains &rarr; fewer cars &rarr; traffic speeds up &rarr; some switch back to cars.</p><h3>Exercise</h3><p>Map one reinforcing and one balancing loop in a system you interact with daily. Identify: the variables, the direction of influence, and whether it is currently helping or hurting.</p><hr><h2>Module 3: Leverage Points</h2><p>Donella Meadows identified 12 places to intervene in a system. The most effective are the least obvious.</p><h3>The 12 Leverage Points (most to least effective)</h3><ol><li><strong>The power to transcend paradigms</strong> - No paradigm is true. Let go.</li><li><strong>The mindset or paradigm out of which the system arises</strong> - Change the shared belief.</li><li><strong>The goals of the system</strong> - Change the purpose.</li><li><strong>The structure of information flows</strong> - Who knows what, and when?</li><li><strong>The rules of the system</strong> - Incentives, punishments, constraints.</li><li><strong>The power to add, change, evolve, or self-organize system structure</strong></li><li><strong>The structure of material flows and nodes</strong></li><li><strong>Positive feedback loops</strong> - Slow or accelerate growth.</li><li><strong>Negative feedback loops</strong> - Strengthen or weaken corrective feedback.</li><li><strong>Buffer sizes</strong> - Inventories, savings, reserves.</li><li><strong>Stock-and-flow structures</strong> - Physical infrastructure.</li><li><strong>Constants, parameters, numbers</strong> - Taxes, subsidies, standards.</li></ol><h3>The Insight</h3><p>Most interventions target the bottom of the list (parameters, numbers) because they are easy. The highest leverage - changing paradigms - is hardest because it requires us to question our own assumptions. The most powerful intervention is to work on your own mental models.</p><h3>Exercise</h3><p>Take the problem you mapped in Module 1. For each leverage point, ask: <em>What would it mean to intervene here? What would change? Why is it harder?</em></p><hr><h2>Module 4: Mental Models</h2><p>Mental models are the lenses through which we see the world. They shape what we notice, what we ignore, and what actions seem possible. Every system sits on a foundation of shared mental models.</p><h3>Common Mental Model Traps</h3><p><strong>1. Linear Thinking</strong> - Assuming A causes B in a straight line. Reality is loops, not lines.<br><strong>2. Silo Thinking</strong> - Focusing only on your part of the system without seeing the whole.<br><strong>3. Short-Term Bias</strong> - Prioritizing immediate results over long-term health.<br><strong>4. Blame</strong> - Attributing system behavior to individuals rather than structure. As Donella Meadows said: ''Blame and responsibility are different things.''<br><strong>5. The Illusion of Control</strong> - Believing you can predict and manage every variable.</p><h3>The Ladder of Inference</h3><p>A tool for surfacing your own mental models:</p><ol><li>I observe data and experiences.</li><li>I select certain data (based on my existing mental models).</li><li>I add meanings and interpretations.</li><li>I make assumptions.</li><li>I draw conclusions.</li><li>I adopt beliefs.</li><li>I take actions based on those beliefs.</li></ol><p>The ladder works both ways. To change a mental model, climb down: examine what data you selected, what meanings you added, and where your assumptions came from.</p><h3>Capstone Exercise</h3><p>Return to your Iceberg from Module 1. At the Mental Models level, identify at least three beliefs that keep the current system in place. For each one, ask: <em>What if this belief is not true? What new possibilities open up?</em></p><p>Write down one shift you can make this week - a change in how you think, not just what you do.</p>' WHERE slug = 'systems-thinking' AND (full_content IS NULL OR full_content = '')`,
      `CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        phase INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        source TEXT NOT NULL DEFAULT 'manual',
        priority TEXT NOT NULL DEFAULT 'medium',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_source ON tasks(source)`,
      // Sponsor auth tables
      `CREATE TABLE IF NOT EXISTS sponsors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        company TEXT NOT NULL DEFAULT '',
        access_code TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS sponsor_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at TEXT NOT NULL,
        FOREIGN KEY (email) REFERENCES sponsors(email)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_sponsors_email ON sponsors(email)`,
      `CREATE INDEX IF NOT EXISTS idx_sponsor_sessions_token ON sponsor_sessions(token)`,
      // Email automation queue
      `CREATE TABLE IF NOT EXISTS email_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        to_email TEXT NOT NULL,
        to_name TEXT DEFAULT '',
        subject TEXT NOT NULL,
        html_content TEXT NOT NULL,
        email_type TEXT NOT NULL DEFAULT 'manual',
        scheduled_at TEXT NOT NULL DEFAULT (datetime('now')),
        sent_at TEXT DEFAULT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled ON email_queue(scheduled_at)`,
      `CREATE INDEX IF NOT EXISTS idx_email_queue_sent ON email_queue(sent_at)`,
      // Seed test sponsor
      `INSERT OR IGNORE INTO sponsors (email, company, access_code) VALUES ('sponsor@test.com', 'Test Corp', 'SPONSOR2026')`,
      // Subscriptions table for recurring supporter tiers
      `CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        name TEXT DEFAULT '',
        tier TEXT NOT NULL DEFAULT 'monthly',
        amount REAL NOT NULL DEFAULT 50,
        currency TEXT NOT NULL DEFAULT 'GHS',
        flw_subscription_id TEXT DEFAULT '',
        flw_plan_id TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active',
        start_date TEXT NOT NULL DEFAULT (datetime('now')),
        next_billing TEXT DEFAULT '',
        cancelled_at TEXT DEFAULT '',
        tx_ref TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE INDEX IF NOT EXISTS idx_subscriptions_email ON subscriptions(email)`,
      `CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)`,
      // Student accounts table (registration before enrollment)
      `CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL UNIQUE,
        phone TEXT DEFAULT '',
        access_code TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE INDEX IF NOT EXISTS idx_students_email ON students(email)`,
      // Module progress tracking tables
      `CREATE TABLE IF NOT EXISTS modules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        program_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        slug TEXT NOT NULL,
        description TEXT DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (program_id) REFERENCES programs(id),
        UNIQUE(program_id, slug)
      )`,
      `CREATE TABLE IF NOT EXISTS module_completions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        enrollment_id INTEGER NOT NULL,
        module_id INTEGER NOT NULL,
        completed_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (enrollment_id) REFERENCES enrollments(id),
        FOREIGN KEY (module_id) REFERENCES modules(id),
        UNIQUE(enrollment_id, module_id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_modules_program ON modules(program_id)`,
      `CREATE INDEX IF NOT EXISTS idx_modules_slug ON modules(slug)`,
      `CREATE INDEX IF NOT EXISTS idx_mc_enrollment ON module_completions(enrollment_id)`,
      // Certificates table
      `CREATE TABLE IF NOT EXISTS certificates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        enrollment_id INTEGER NOT NULL,
        student_name TEXT NOT NULL,
        student_email TEXT NOT NULL,
        program_title TEXT NOT NULL,
        program_slug TEXT NOT NULL,
        certificate_code TEXT NOT NULL UNIQUE,
        issued_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (enrollment_id) REFERENCES enrollments(id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_certificates_code ON certificates(certificate_code)`,
      `CREATE INDEX IF NOT EXISTS idx_certificates_email ON certificates(student_email)`,
      // Gamification: XP columns on enrollments
      `ALTER TABLE enrollments ADD COLUMN xp INTEGER DEFAULT 0`,
      `ALTER TABLE enrollments ADD COLUMN xp_level INTEGER DEFAULT 1`,
      `ALTER TABLE enrollments ADD COLUMN streak INTEGER DEFAULT 0`,
      `ALTER TABLE enrollments ADD COLUMN last_module_at TEXT DEFAULT ''`,
      // Achievements table (definitions)
      `CREATE TABLE IF NOT EXISTS achievements (
        key TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        icon TEXT DEFAULT ''
      )`,
      `INSERT OR IGNORE INTO achievements (key, name, description, icon) VALUES
        ('first_step', 'First Step', 'Complete your first module', '🚀'),
        ('halfway', 'Halfway There', 'Complete 50% of a program', '⭐'),
        ('scholar', 'Genesis Scholar', 'Complete all modules in a program', '🏆'),
        ('on_fire', 'On Fire', 'Complete 2 modules in 24 hours', '🔥'),
        ('perfect_week', 'Perfect Week', 'Complete modules on 5 different days in one week', '📅')
      `,
      // Student earned achievements
      `CREATE TABLE IF NOT EXISTS student_achievements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_email TEXT NOT NULL,
        enrollment_id INTEGER NOT NULL,
        achievement_key TEXT NOT NULL,
        earned_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (enrollment_id) REFERENCES enrollments(id),
        UNIQUE(student_email, enrollment_id, achievement_key)
      )`,
      // CI/CD pipeline reports
      `CREATE TABLE IF NOT EXISTS ci_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'unknown',
        test_count INTEGER NOT NULL DEFAULT 0,
        test_passed INTEGER NOT NULL DEFAULT 0,
        test_failed INTEGER NOT NULL DEFAULT 0,
        coverage_pct REAL NOT NULL DEFAULT 0,
        branch TEXT NOT NULL DEFAULT 'main',
        triggered_by TEXT NOT NULL DEFAULT 'push',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS referral_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        owner_email TEXT NOT NULL,
        owner_name TEXT DEFAULT '',
        total_conversions INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE INDEX IF NOT EXISTS idx_ref_codes_code ON referral_codes(code)`,
      `CREATE TABLE IF NOT EXISTS share_unlocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        content_slug TEXT NOT NULL,
        share_platform TEXT DEFAULT '',
        unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(email, content_slug)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_sa_enrollment ON student_achievements(enrollment_id)`,
      // Seed module definitions for Systems Thinking and Architectural Thinking
      `INSERT OR IGNORE INTO modules (program_id, title, slug, description, sort_order) VALUES
        ((SELECT id FROM programs WHERE slug = 'systems-thinking'), 'Module 1: The Iceberg Model', 'iceberg-model', 'See below the surface — events, patterns, structure, and mental models.', 1),
        ((SELECT id FROM programs WHERE slug = 'systems-thinking'), 'Module 2: Feedback Loops', 'feedback-loops', 'Reinforcing and balancing loops that drive growth, stability, and collapse.', 2),
        ((SELECT id FROM programs WHERE slug = 'systems-thinking'), 'Module 3: Leverage Points', 'leverage-points', 'Where to intervene in a system for maximum impact with minimum effort.', 3),
        ((SELECT id FROM programs WHERE slug = 'systems-thinking'), 'Module 4: Mental Models', 'mental-models', 'The beliefs, values, and assumptions that shape system behavior.', 4),
        ((SELECT id FROM programs WHERE slug = 'architectural-thinking'), 'Module 1: Blueprint Thinking', 'blueprint-thinking', 'Structuring ideas and projects with clarity and purpose before building.', 1),
        ((SELECT id FROM programs WHERE slug = 'architectural-thinking'), 'Module 2: Design Principles', 'design-principles', 'Core principles for building anything that matters — form, function, and strength.', 2),
        ((SELECT id FROM programs WHERE slug = 'architectural-thinking'), 'Module 3: Strategic Frameworks', 'strategic-frameworks', 'Mental models and frameworks for strategic planning and decision-making.', 3),
        ((SELECT id FROM programs WHERE slug = 'architectural-thinking'), 'Module 4: Execution & Systems', 'execution-systems', 'From blueprint to reality — closing the gap between vision and execution.', 4)`,
      `INSERT OR IGNORE INTO tasks (title, description, phase, status, source, priority) VALUES
        ('Create D1 database and define schema', 'Create D1 database gahq in Cloudflare dashboard with tables: subscribers, donations, bookings, page_views', 3, 'done', 'agent', 'high'),
        ('Create admin CRUD Workers for each D1 table', 'Deploy /api/admin/* CRUD Workers for donations, bookings, testimonials, stats, gallery', 3, 'done', 'agent', 'high'),
        ('Bind D1 database to Pages project', 'Configure D1 binding as DB variable in Cloudflare Pages dashboard', 3, 'done', 'agent', 'high'),
        ('Migrate existing KV subscriber data to D1', 'Port all subscriber records from KV namespace to D1 subscribers table', 3, 'done', 'agent', 'high'),
        ('Embed Flutterwave checkout on donation page', 'Replace external payment links with embedded Flutterwave checkout and webhook', 3, 'done', 'agent', 'high'),
        ('Create Flutterwave payment webhook Worker', '/api/payments/flutterwave — handles 8 event types with D1 upsert', 3, 'done', 'agent', 'high'),
        ('Add payment to ad booking flow', 'Booking modal captures payment via Flutterwave, stores to D1 with status tracking', 3, 'done', 'agent', 'high'),
        ('Integrate premium content pay-per-download', 'Book bundle GH¢300 purchase flow via Flutterwave with download tracking', 3, 'done', 'agent', 'medium'),
        ('Build admin donation/booking dashboard with charts', 'Admin dashboard with revenue charts, funnel, CSV export for donations and bookings', 3, 'done', 'agent', 'medium'),
        ('D1-backed admin CRUD for testimonials, stats, gallery', 'Admin content page with full CRUD; data served to frontend via public API endpoints', 3, 'done', 'agent', 'high'),
        ('Replace hardcoded page data with API-driven content', 'Homepage testimonials, stats, gallery load from D1 via /api/testimonials, /api/stats, /api/gallery', 3, 'done', 'agent', 'medium'),
        ('Build newsletter editor in admin panel', 'Admin panel for composing and sending newsletters', 3, 'done', 'agent', 'low'),
        ('Create PayPal Business account + donate button', 'Accept PayPal donations alongside Flutterwave for broader reach', 5, 'done', 'agent', 'high'),
        ('Fix donation page redirect to generic PayPal.me', 'Current donation page redirects to PayPal.me which breaks the flow', 5, 'done', 'agent', 'high'),
        ('Match payment logging to Flutterwave webhook events', 'Log all Flutterwave event types (successful, failed, refunded) to D1', 5, 'done', 'agent', 'high'),
        ('Fix ad booking payment flow end-to-end', 'Booking modal must capture payment on submit, auto-update status', 5, 'done', 'agent', 'high'),
        ('Build revenue dashboard with reconciliation', 'Admin view showing real donation/booking revenue with CSV export', 5, 'done', 'agent', 'medium'),
        ('Restore missing donate page', 'Donate page at /donate/ is missing; donations route through homepage modal only', 5, 'done', 'agent', 'high'),
        ('Gate school program courses behind payment', 'Auto-generate access tokens on purchase, student dashboard', 6, 'done', 'agent', 'medium'),
        ('Set up digital book sales with pay-per-download', 'Purchase flow via Flutterwave, track downloads per customer', 6, 'done', 'agent', 'medium'),
        ('Create sponsored slot pricing + newsletter tiers', 'Premium newsletter tiers with auto-billing for subscribers', 6, 'done', 'agent', 'low'),
        ('Replace hardcoded homepage content with D1 API', 'Testimonials, stats, gallery should load from D1 not hardcoded HTML', 6, 'done', 'agent', 'medium'),
        ('Build strategic partnership outreach system', 'Co-branded landing pages, referral tracking with rewards', 7, 'done', 'agent', 'low'),
        ('Create press kit and pitch to Ghanaian media', 'Bio, photos, book synopses for media outreach and guest content', 7, 'done', 'agent', 'low'),
        ('Add JSON-LD structured data + sitemap.xml', 'Submit to Google Search Console for organic SEO growth', 7, 'done', 'agent', 'medium'),
        ('Build referral API endpoints', 'Generate, claim, and track referral codes via /api/referral/*', 7, 'done', 'agent', 'high'),
        ('Share-to-unlock premium content widget', 'Users share to unlock premium articles and book chapters', 7, 'done', 'agent', 'medium'),
        ('Partners page with inquiry form', 'partners/index.html with co-branded landing, referral tracking info', 7, 'done', 'agent', 'high'),
        ('Press kit page', 'press/index.html with bio, book synopses, media inquiry form', 7, 'done', 'agent', 'high'),
        ('Content library page', 'content/index.html with article feed, newsletter subscribe block', 7, 'done', 'agent', 'high'),
        ('Outreach to churches, schools, and NGOs', 'Reach out to 10+ aligned organizations in Ghana/Africa for partnerships', 7, 'pending', 'manual', 'high'),
        ('Set up Google Search Console and submit sitemap', 'Verify domain ownership, submit sitemap.xml, monitor indexing', 7, 'pending', 'manual', 'high'),
        ('Pitch to Ghanaian/African media outlets', 'Send press kit and pitch to 5+ podcast/TV/radio outlets', 7, 'pending', 'manual', 'high'),
        ('Publish 6 long-form articles on content library', 'Write and publish the 6 placeholder articles on content page', 7, 'pending', 'manual', 'medium'),
        ('Build backlinks from 3+ external sites', 'Guest posts, partner mentions, and directory listings', 7, 'pending', 'manual', 'medium'),
        ('Promote referral program in newsletter and social', 'Add referral CTA to newsletter, social posts, and key pages', 7, 'pending', 'manual', 'low'),
        ('Build AI content assistant for newsletter', 'Draft newsletters via API, auto-generate SEO meta descriptions', 8, 'pending', 'agent', 'low'),
        ('Create predictive analytics dashboard', 'Revenue forecasting, subscriber growth predictions, anomaly detection', 8, 'pending', 'agent', 'low'),
('Wire Flutterwave checkout for program purchase', 'Add payment processing so users can pay GH¢250 and get full access to Systems Thinking', 6, 'done', 'agent', 'high'),
        ('Auto-generate full-access token on successful payment', 'After Flutterwave webhook confirms payment, upgrade enrollment status and return full content', 6, 'done', 'agent', 'high'),
        ('Distinguish free sample vs paid full access in dashboard', 'Show sample content for free enrollments, full modules for paid enrollments', 6, 'done', 'agent', 'medium'),
        ('Admin page to manage programs & content', 'CRUD page for programs table — edit modules, pricing, sample content', 6, 'done', 'agent', 'medium'),
        ('Student progress tracking', 'Track which modules each student has completed', 6, 'done', 'agent', 'low'),
('Write Systems Thinking module 1: Iceberg Model', 'Deep-dive content with examples, diagrams, and practical exercises', 6, 'done', 'agent', 'high'),
        ('Write Systems Thinking module 2: Feedback Loops', 'Reinforcing and balancing loops with real-world case studies', 6, 'done', 'agent', 'high'),
        ('Write Systems Thinking module 3: Leverage Points', 'Where to intervene in a system for maximum impact', 6, 'done', 'agent', 'high'),
        ('Write Systems Thinking module 4: Mental Models', 'How beliefs and assumptions shape system behavior', 6, 'done', 'agent', 'high'),
        ('Write Architectural Thinking module 1: Blueprint Thinking', 'Structuring ideas and projects with clarity and purpose', 6, 'pending', 'agent', 'medium'),
        ('Write Architectural Thinking module 2: Design Principles', 'Core principles for building anything that matters', 6, 'pending', 'agent', 'medium'),
        ('Write Architectural Thinking module 3: Strategic Frameworks', 'Mental models and frameworks for strategic planning', 6, 'pending', 'agent', 'medium'),
        ('Write Architectural Thinking module 4: Execution & Systems', 'From blueprint to execution — making it real', 6, 'pending', 'agent', 'medium'),
        ('Welcome sequence for newsletter subscribers', 'Build welcome email + day 3 follow-up with school invite', 4, 'done', 'agent', 'high'),
        ('Auto follow-up for manifesto downloaders', 'Day 3 follow-up email with download link and share request', 4, 'done', 'agent', 'high'),
        ('Donation thank-you sequences', 'Receipt email + day 3 impact update follow-up', 4, 'done', 'agent', 'high'),
        ('Create email_queue D1 table', 'Store pending/scheduled emails for automation sequences', 4, 'done', 'agent', 'high'),
        ('Build email queue processing endpoint', '/api/email/process — sends due queued emails via Brevo SMTP', 4, 'done', 'agent', 'high')
      `,
      // Mark Phase 6.1 as done (book sales)
      `UPDATE tasks SET status = 'done' WHERE id IN (SELECT id FROM tasks WHERE title = 'Set up digital book sales with pay-per-download' AND phase = 6)`,
      `INSERT OR IGNORE INTO books (title, slug, description, price, file_url, is_premium, sort_order) VALUES
        ('The Bible as Kingdom OS', 'the-bible-as-kingdom-os', 'A paradigm-shifting exploration of the Bible as the operating system of the Kingdom of God.', 0, '/books/the-bible-as-kingdom-os.pdf', 0, 1),
        ('The Divine Algorithm', 'divine-algorithm', 'An interactive report exploring divine patterns, codes, and algorithms hidden in Scripture.', 0, '/books/divine_algorithm_report.html', 0, 2),
        ('AI-Powered Strategic National Development For Ghana', 'ai-national-development', 'A visionary blueprint for leveraging AI to accelerate Ghana national development.', 0, '/books/ai-powered-strategic-national-development-ghana.docx', 0, 3),
        ('1 Million Coders Manifesto', '1-million-coders-manifesto', 'A bold manifesto challenging the popular narrative on tech education in Ghana.', 0, '/books/Ghana_Does_Not_Need_1_Million_Coders_Manifesto_v2.pdf', 0, 4),
        ('Premium Books Bundle', 'premium-bundle', 'All 4 published works in one premium download package. Plus exclusive thank-you page.', 300, '/books/premium-bundle.html', 1, 5)
      `,
      // Mark Phase 5 + 6.1 tasks as done (for existing installations)
      `UPDATE tasks SET status = 'done' WHERE phase = 5 AND status = 'pending'`,
      `UPDATE tasks SET status = 'done' WHERE phase = 6 AND title LIKE '%book sales%' AND status = 'pending'`,
      `UPDATE tasks SET status = 'done' WHERE phase = 6 AND title LIKE '%hardcoded homepage%' AND status = 'pending'`,
      `UPDATE tasks SET status = 'done' WHERE phase = 6 AND title LIKE '%Architectural Thinking module%' AND status = 'pending'`,
      `UPDATE tasks SET status = 'done' WHERE phase = 6 AND title LIKE '%sponsored slot pricing%' AND status = 'pending'`,
      `UPDATE tasks SET status = 'done' WHERE phase = 6 AND title LIKE '%student progress%' AND status = 'pending'`,
      // Mark Phase 7 infrastructure tasks as done (for existing installations)
      `UPDATE tasks SET status = 'done' WHERE phase = 7 AND title LIKE '%strategic partnership%' AND status = 'pending'`,
      `UPDATE tasks SET status = 'done' WHERE phase = 7 AND title LIKE '%press kit%' AND status = 'pending'`,
      `UPDATE tasks SET status = 'done' WHERE phase = 7 AND title LIKE '%JSON-LD%' AND status = 'pending'`,
      `UPDATE tasks SET status = 'done' WHERE phase = 7 AND title LIKE '%referral API%' AND status = 'pending'`,
      `UPDATE tasks SET status = 'done' WHERE phase = 7 AND title LIKE '%Share-to-unlock%' AND status = 'pending'`,
      `UPDATE tasks SET status = 'done' WHERE phase = 7 AND title LIKE '%Partners page%' AND status = 'pending'`,
      `UPDATE tasks SET status = 'done' WHERE phase = 7 AND title LIKE '%Press kit page%' AND status = 'pending'`,
      `UPDATE tasks SET status = 'done' WHERE phase = 7 AND title LIKE '%Content library page%' AND status = 'pending'`,
      // Seed additional programs
      `INSERT OR IGNORE INTO programs (title, slug, tagline, description, duration, price, price_label, status, sample_content, full_content, sort_order) VALUES
        ('Systems Thinking in Genesis', 'systems-thinking-genesis', 'Biblical Foundations of Systems Thinking', 'Explore the book of Genesis through a systems thinking lens. See creation, the fall, the patriarchs, and the exodus as interconnected systems with feedback loops, leverage points, and emergent properties.', 'Self-paced', 0, 'Free', 'active', '<h2>Welcome to Systems Thinking in Genesis</h2><p>The Bible is not just a collection of stories — it is a living system. In this program, we examine Genesis through the lens of systems thinking.</p>', '<h2>Full Curriculum: Systems Thinking in Genesis</h2><p>This course explores the book of Genesis as a case study in systems thinking. Each module reveals a different systems concept through the biblical narrative, from creation to the exodus. By the end, you will see Scripture not just as stories — but as a living system of interlocking patterns, feedback loops, and emergent design.</p><hr><h2>Module 1: Creation as a System</h2><h3>Key Idea: Interdependence and Nested Hierarchy</h3><p>The six days of creation are not a random sequence. Each day prepares the environment for what follows. Light makes photosynthesis possible. The sky creates the water cycle. Land provides a habitat. Plants produce oxygen and food. The sun and moon govern seasons and rhythms. Sea creatures and birds populate their domains. Land animals and humanity inherit a fully functioning ecosystem.</p><p>This is a <strong>nested hierarchy</strong> of systems: each level contains and enables the next. In systems thinking, we call this <strong>holarchy</strong> — every system is both a whole and a part of a larger whole.</p><h3>Systems Concepts in This Module</h3><ul><li><strong>Interdependence</strong> — No element exists in isolation. Each day depends on the days before it.</li><li><strong>Emergence</strong> — The whole (a functioning ecosystem) is greater than the sum of its parts.</li><li><strong>Feedback Readiness</strong> — Creation is designed with feedback loops built in: seed-bearing plants reproduce, waters teem with life.</li></ul><h3>Application Exercise</h3><p>Identify a system in your life. Map its elements as a nested hierarchy. What does each level depend on? What emerges when all parts work together?</p><hr><h2>Module 2: Patterns in the Patriarchs</h2><h3>Key Idea: Reinforcing and Balancing Feedback Loops</h3><p>The lives of Abraham, Isaac, and Jacob are filled with recurring patterns: promise, waiting, failure, rescue, blessing. These are <strong>feedback loops</strong> that shape the covenant people.</p><p>A <strong>reinforcing feedback loop</strong> amplifies change. When God promises Abraham descendants, and Abraham believes, each act of faith reinforces the next. A <strong>balancing feedback loop</strong> resists change — when the patriarchs stray, consequences bring them back.</p><h3>Systems Concepts in This Module</h3><ul><li><strong>Reinforcing Loops</strong> — Faith leads to blessing, reinforcing faith.</li><li><strong>Balancing Loops</strong> — Consequences maintain alignment with covenant.</li><li><strong>Delayed Feedback</strong> — Patriarchs waited decades. Delayed feedback tests faith.</li><li><strong>Pattern Recognition</strong> — See recurring structures beneath surface events.</li></ul><h3>Application Exercise</h3><p>Identify a recurring pattern in your life. Is it reinforcing or balancing? What would it take to change the loop?</p><hr><h2>Module 3: Joseph''s Economic System</h2><h3>Key Idea: Anticipatory Governance and Stock-and-Flow Dynamics</h3><p>Joseph''s management of seven years of abundance and famine is a masterclass in <strong>anticipatory governance</strong> — designing for future states rather than reacting to crises.</p><p>In systems thinking, we model this with <strong>stocks and flows</strong>. Grain is the <strong>stock</strong>. The <strong>inflow</strong> is the abundant harvest. The <strong>outflow</strong> is consumption during famine. Joseph increased inflows (stored grain) and controlled outflows (rationed distribution).</p><h3>Systems Concepts in This Module</h3><ul><li><strong>Stocks and Flows</strong> — Accumulation, depletion, and equilibrium.</li><li><strong>Leverage Points</strong> — Storage capacity changed the system''s ability to handle scarcity.</li><li><strong>Feedback Delay</strong> — Seven-year cycles show long delays between action and consequence.</li><li><strong>Resilience</strong> — Egypt not only survived but thrived, acquiring resources from surrounding nations.</li></ul><h3>Application Exercise</h3><p>Identify a stock in your life (savings, knowledge, relationships). What are its inflows and outflows? Build buffer capacity before scarcity.</p><hr><h2>Module 4: The Exodus as a Feedback Loop</h2><h3>Key Idea: Reinforcing Feedback Loops of Liberation</h3><p>The Exodus is a <strong>reinforcing feedback loop</strong>: Cry Out → God Hears → Deliverance → Covenant → Worship. Each cycle builds on the last.</p><p>The ten plagues target specific Egyptian systems: the Nile (water), livestock (agriculture), crops (food), firstborn (social order). Each plague is a <strong>feedback signal</strong> that the system is unjust. Pharaoh''s resistance creates conditions for greater liberation — a classic <strong>Shifting the Burden</strong> archetype.</p><h3>Systems Concepts in This Module</h3><ul><li><strong>Reinforcing Loop</strong> — Liberation grows stronger with each cycle.</li><li><strong>Leverage Points</strong> — Plagues target pressure points in interconnected systems.</li><li><strong>Emergence</strong> — A group of slaves becomes a nation.</li><li><strong>Unintended Consequences</strong> — Suppression strengthens the system being suppressed.</li></ul><h3>Application Exercise</h3><p>Think of a situation where trying to solve a problem made it worse. Map it as a reinforcing loop. What leverage point could shift it positively?</p><hr><p style=""color:#C9A84C;font-style:italic"">Continue to the next module when ready. Each module builds on the previous one.</p>', 3),
        ('Introduction to Design Thinking', 'intro-design-thinking', 'A Human-Centered Approach to Problem Solving', 'Learn the fundamentals of design thinking: empathize, define, ideate, prototype, and test. A practical framework for creative problem solving that puts people first.', 'Self-paced', 0, 'Free', 'coming_soon', '<h2>Coming Soon: Introduction to Design Thinking</h2><p>This program is currently in development. We are crafting a rich, practical introduction to design thinking — the human-centered approach to innovation that puts people first.</p><p>In the meantime, explore <a href="/school/">Systems Thinking in Genesis</a> to start your learning journey.</p>', '', 4),
        ('Design Thinking in Genesis \u2013 The Creation', 'design-thinking-genesis', 'The Original Design Blueprint', 'Discover how the Genesis creation account reveals the ultimate design thinking process. From the separation of light and darkness to the creation of humanity, every step follows a divine design methodology.', 'Self-paced', 0, 'Free', 'coming_soon', '<h2>Coming Soon: Design Thinking in Genesis</h2><p>This program is currently in development. We are exploring how the Genesis creation account reveals the original design thinking process — intentionality, iteration, form and function, and stewardship as design.</p><p>In the meantime, explore <a href="/school/">Systems Thinking in Genesis</a> to start your learning journey.</p>', '', 5),
        ('Introduction to Biomimicry', 'intro-biomimicry', 'Learning from Nature''s Genius', 'Nature has been solving problems for 3.8 billion years. Biomimicry is the practice of learning from nature''s patterns and strategies to create sustainable human solutions.', 'Self-paced', 0, 'Free', 'coming_soon', '<h2>Coming Soon: Introduction to Biomimicry</h2><p>This program is currently in development. We are building a fascinating journey into biomimicry — learning from nature''s genius to solve human challenges.</p><p>In the meantime, explore <a href="/school/">Systems Thinking in Genesis</a> to start your learning journey.</p>', '', 6),
        ('Introduction to Geometry', 'intro-geometry', 'The Dot, Dots, Lines, Angles, Shapes, Planes and Forms', 'A foundational journey through geometry - from the simplest dot to complex planes and forms. Understand the language of shape, space, and structure that underlies all creation.', 'Self-paced', 0, 'Free', 'coming_soon', '<h2>Coming Soon: Introduction to Geometry</h2><p>This program is currently in development. We are building a foundational journey through geometry — from the dot to planes and forms, the language of shape and space that underlies all creation.</p><p>In the meantime, explore <a href="/school/">Systems Thinking in Genesis</a> to start your learning journey.</p>', '', 7),
        ('Introduction to The Computer & Computing', 'intro-computing', 'Understanding the Digital Revolution', 'What is a computer? How does it think? This program takes you from the fundamentals of computing hardware and software to how computers process, store, and communicate information.', 'Self-paced', 0, 'Free', 'coming_soon', '<h2>Coming Soon: Introduction to Computing</h2><p>This program is currently in development. We are creating a clear, accessible introduction to how computers work — from hardware and software to binary logic and the digital world.</p><p>In the meantime, explore <a href="/school/">Systems Thinking in Genesis</a> to start your learning journey.</p>', '', 8),
        ('Introduction to Storytelling & Narrative Design', 'intro-storytelling', 'The Art of Shaping Meaning', 'Storytelling is the bridge between knowledge and impact. This program teaches narrative structure, character arcs, metaphor, and oral tradition — from biblical foundations to modern media. Learn to craft stories that inform, inspire, and transform.', 'Self-paced', 0, 'Free', 'coming_soon', '<h2>Coming Soon: Storytelling & Narrative Design</h2><p>This program is currently in development. We are crafting a deep exploration of narrative — from biblical foundations to modern media — so you can learn to tell stories that inform, inspire, and transform.</p><p>In the meantime, explore <a href="/school/">Systems Thinking in Genesis</a> to start your learning journey.</p>', '', 9)
      `,
      // Module seeds for new programs
      `INSERT OR IGNORE INTO modules (program_id, title, slug, description, sort_order) VALUES
        ((SELECT id FROM programs WHERE slug = 'systems-thinking-genesis'), 'Module 1: Creation as a System', 'genesis-creation-system', 'The six days of creation reveal interdependence, nested hierarchy, and emergence. Explore how each day prepares the environment for the next, from light to humanity, forming a fully functioning ecosystem designed with feedback loops.', 1),
        ((SELECT id FROM programs WHERE slug = 'systems-thinking-genesis'), 'Module 2: Patterns in the Patriarchs', 'genesis-patriarchs', 'The lives of Abraham, Isaac, and Jacob reveal reinforcing and balancing feedback loops — promise, waiting, failure, rescue, blessing. Learn to recognize recurring structures beneath surface events and understand delayed feedback in biblical narrative.', 2),
        ((SELECT id FROM programs WHERE slug = 'systems-thinking-genesis'), 'Module 3: Joseph''s Economic System', 'genesis-joseph', 'Joseph''s management of abundance and famine is a masterclass in stocks, flows, leverage points, and anticipatory governance. Understand how building buffer capacity transforms a system''s resilience using one of history''s earliest economic case studies.', 3),
        ((SELECT id FROM programs WHERE slug = 'systems-thinking-genesis'), 'Module 4: The Exodus as a Feedback Loop', 'genesis-exodus', 'The Exodus is a reinforcing feedback loop of liberation: cry out, deliverance, covenant, worship. The plagues target systemic leverage points in Egypt''s interconnected systems. Learn about emergence, unintended consequences, and the Shifting the Burden archetype.', 4),
        ((SELECT id FROM programs WHERE slug = 'intro-design-thinking'), 'Module 1: What is Design Thinking?', 'dt-intro', 'The five phases of design thinking and the mindset behind them.', 1),
        ((SELECT id FROM programs WHERE slug = 'intro-design-thinking'), 'Module 2: Empathize & Define', 'dt-empathize', 'Understanding users and framing the right problem to solve.', 2),
        ((SELECT id FROM programs WHERE slug = 'intro-design-thinking'), 'Module 3: Ideate & Prototype', 'dt-ideate', 'Generating ideas and building quick prototypes to test assumptions.', 3),
        ((SELECT id FROM programs WHERE slug = 'intro-design-thinking'), 'Module 4: Test & Iterate', 'dt-test', 'Testing solutions, gathering feedback, and iterating toward better outcomes.', 4),
        ((SELECT id FROM programs WHERE slug = 'design-thinking-genesis'), 'Module 1: The Ultimate Designer', 'dtg-designer', 'God as the original design thinker - intentionality in creation.', 1),
        ((SELECT id FROM programs WHERE slug = 'design-thinking-genesis'), 'Module 2: Form and Function in Creation', 'dtg-form-function', 'How each created thing has both form and purpose.', 2),
        ((SELECT id FROM programs WHERE slug = 'design-thinking-genesis'), 'Module 3: Iteration and Rhythms', 'dtg-iteration', 'The daily rhythm of creation as a design iteration cycle.', 3),
        ((SELECT id FROM programs WHERE slug = 'design-thinking-genesis'), 'Module 4: Stewardship as Design', 'dtg-stewardship', 'Humanity as stewards - designed to design.', 4),
        ((SELECT id FROM programs WHERE slug = 'intro-biomimicry'), 'Module 1: Nature as Mentor', 'bio-mentor', 'Why nature is the world''s best engineer and designer.', 1),
        ((SELECT id FROM programs WHERE slug = 'intro-biomimicry'), 'Module 2: Patterns in Nature', 'bio-patterns', 'Recurring patterns - spirals, fractals, hexagons, and branching.', 2),
        ((SELECT id FROM programs WHERE slug = 'intro-biomimicry'), 'Module 3: Biomimetic Design', 'bio-design', 'How biomimicry is used in architecture, materials, and technology.', 3),
        ((SELECT id FROM programs WHERE slug = 'intro-biomimicry'), 'Module 4: Case Studies', 'bio-cases', 'Real-world examples of biomimicry solving human challenges.', 4),
        ((SELECT id FROM programs WHERE slug = 'intro-geometry'), 'Module 1: The Dot and Points', 'geo-dot', 'The simplest element - the dot, and how points define space.', 1),
        ((SELECT id FROM programs WHERE slug = 'intro-geometry'), 'Module 2: Dots, Lines and Angles', 'geo-lines', 'From dots to lines, rays, segments, and the angles they form.', 2),
        ((SELECT id FROM programs WHERE slug = 'intro-geometry'), 'Module 3: Shapes and Forms', 'geo-shapes', 'Two-dimensional shapes and three-dimensional forms.', 3),
        ((SELECT id FROM programs WHERE slug = 'intro-geometry'), 'Module 4: Planes and Space', 'geo-planes', 'Understanding planes, dimensions, and spatial relationships.', 4),
        ((SELECT id FROM programs WHERE slug = 'intro-computing'), 'Module 1: What is a Computer?', 'comp-what', 'Definition, history, and the core idea of a computing machine.', 1),
        ((SELECT id FROM programs WHERE slug = 'intro-computing'), 'Module 2: Hardware & Software', 'comp-hardware', 'The physical components and the programs that make them useful.', 2),
        ((SELECT id FROM programs WHERE slug = 'intro-computing'), 'Module 3: How Computers Think', 'comp-think', 'Binary, logic gates, and the fundamentals of computation.', 3),
        ((SELECT id FROM programs WHERE slug = 'intro-computing'), 'Module 4: The Digital World', 'comp-digital', 'Networks, the internet, and how computers communicate.', 4),
        ((SELECT id FROM programs WHERE slug = 'intro-storytelling'), 'Module 1: Why Story Matters', 'story-why', 'The neurological, spiritual, and cultural power of narrative.', 1),
        ((SELECT id FROM programs WHERE slug = 'intro-storytelling'), 'Module 2: Narrative Structure', 'story-structure', 'Arcs, beats, and the architecture of a compelling story.', 2),
        ((SELECT id FROM programs WHERE slug = 'intro-storytelling'), 'Module 3: Character, Voice & Metaphor', 'story-character', 'Creating memorable characters, finding your voice, and wielding metaphor.', 3),
        ((SELECT id FROM programs WHERE slug = 'intro-storytelling'), 'Module 4: Storytelling Across Media', 'story-media', 'Oral tradition, written word, visual storytelling, and digital narratives.', 4)
      `,
      // Update existing Architectural Thinking program with full content
      `UPDATE programs SET status = 'coming_soon', tagline = 'From Blueprint to Masterpiece', sample_content = '<h2>Coming Soon: Architectural Thinking Program</h2><p>This program is currently in development. We are crafting a complete curriculum on thinking like an architect — from blueprint thinking to strategic frameworks and execution systems.</p><p>In the meantime, explore <a href="/school/">Systems Thinking in Genesis</a> to start your learning journey.</p>', full_content = '' WHERE slug = 'architectural-thinking'`,
      `INSERT OR IGNORE INTO programs (title, slug, tagline, description, duration, price, price_label, status, sample_content, full_content, sort_order) VALUES ('Systems Thinking Program', 'systems-thinking', 'See the whole. Solve the root. Design the future.', 'Understand the hidden patterns that shape our world. This program teaches you to see interconnected systems, anticipate ripple effects, and design solutions that actually work - whether in business, society, or your personal life. Through case studies, mental models, and practical exercises, you will develop the lens of a systems thinker.', 'Self-paced', 250, 'Free Sample · Full Access GH¢ 250', 'coming_soon', '<h2>Welcome to the Systems Thinking Program</h2><p>Before we dive into the models, let us start with a simple exercise. Look around you right now. Pick one problem - in your work, your community, or your life - and ask: <em>What keeps this problem in place?</em></p><p>That is the first step. Systems thinking begins not with answers, but with better questions.</p><h3>Your First Tool: The Iceberg Model</h3><p>Most people react to events. Systems thinkers look deeper:</p><ul><li><strong>Events</strong> - What happened? (the tip)</li><li><strong>Patterns</strong> - What has been happening over time?</li><li><strong>Structure</strong> - What forces are driving these patterns?</li><li><strong>Mental Models</strong> - What beliefs keep this structure in place?</li></ul><p>For the full program, you will get video walkthroughs, real-world case studies, worksheets, and community exercises.</p>', '', 1), ('Architectural Thinking Program', 'architectural-thinking', 'From Blueprint to Masterpiece', 'Learn to think like an architect - structuring ideas, projects, and systems with clarity and purpose. This program covers mental models, design principles, and strategic frameworks for building anything that matters. From blueprints to execution, you will learn how to design solutions that stand the test of time.', 'Self-paced', 0, 'Free', 'coming_soon', '<h2>Welcome to the Architectural Thinking Program</h2><p>Architects do not build by accident. Before a single brick is laid, they have a plan - a blueprint that accounts for structure, load, flow, and beauty. Architectural Thinking applies this same discipline to ideas, projects, and systems.</p><p>This program will teach you to think like an architect: to see the whole before the parts, to design with principles instead of impulses, and to build things that last.</p><h3>What You Will Learn</h3><ul><li><strong>Module 1: Blueprint Thinking</strong> - How to structure ideas and projects with clarity and purpose</li><li><strong>Module 2: Design Principles</strong> - Core principles for building anything that matters</li><li><strong>Module 3: Strategic Frameworks</strong> - Mental models for strategic planning</li><li><strong>Module 4: Execution and Systems</strong> - From blueprint to reality</li></ul><p>Start with Module 1 below.</p>', '<h2>Module 1: Blueprint Thinking</h2><p>Every great building starts with a blueprint. Not a sketch. Not a vague idea. A detailed plan that accounts for every beam, every load, every flow of people and energy. Blueprint Thinking applies this same rigor to your ideas and projects.</p><h3>Why Blueprint First?</h3><p>Most people start with execution. They jump into building without a plan, mistaking motion for progress. The result is rework, waste, and collapse.</p><p>Blueprint Thinking reverses this. You invest time upfront in thinking so you save time十倍 in doing. As the architect Daniel Burnham said: <em>"Make no little plans. They have no magic to stir men's blood."</em></p><h3>The Four Questions of Blueprint Thinking</h3><p>Before any project, ask these four questions:</p><p><strong>1. What are we building?</strong> - Define the output with clarity. A website? A team? A movement? A product? Be specific. A vague output produces a vague result.</p><p><strong>2. Why does it exist?</strong> - What purpose does it serve? What problem does it solve? What need does it meet? Purpose is the foundation. Without it, the structure has no reason to stand.</p><p><strong>3. Who is it for?</strong> - Who will use it, live in it, or be affected by it? Every architectural decision should serve the user. If you do not know who you are building for, you are building for yourself.</p><p><strong>4. How will it hold together?</strong> - What is the structural logic? How do the parts relate to the whole? What are the dependencies, the flows, the load-bearing elements?</p><h3>Exercise: Your First Blueprint</h3><p>Take a project you are currently working on - or one you have been procrastinating on. Write a one-page blueprint that answers the four questions above. Do not start execution until the blueprint is complete.</p><hr><h2>Module 2: Design Principles</h2><p>Principles are not rules. Rules tell you what to do. Principles tell you how to think. When you have strong principles, you do not need rules - because you can reason from first principles in any situation.</p><h3>Principle 1: Form Follows Function</h3><p>The shape of anything should be determined by its purpose. A chair looks like a chair because it is designed for sitting. A bridge looks like a bridge because it is designed for crossing. When you force function to follow form, you get style over substance.</p><p>Ask: <em>Does the form of this project serve its function? Or am I choosing form for its own sake?</em></p><h3>Principle 2: Less is More</h3><p>Every addition is a subtraction. When you add a feature, a page, a step, or a rule, you subtract from clarity, speed, and focus. The best designs are not the ones with the most features - they are the ones with the fewest, most essential features executed well.</p><p>The architect Ludwig Mies van der Rohe said: <em>"Less is more."</em> This does not mean minimalism for its own sake. It means that every element must earn its place.</p><h3>Principle 3: Strength Through Structure</h3><p>A building is only as strong as its structure. The same is true for organizations, projects, and systems. Invest in the structure - the relationships, the workflows, the feedback loops - and the surface will take care of itself.</p><p>Ask: <em>What is holding this together? Is the structure strong enough to handle stress and change?</em></p><h3>Principle 4: Design for the Edge Cases</h3><p>The best designs break gracefully. They account for failure, not just success. When you design for the edge cases - the worst-case scenario, the unexpected user, the system under stress - you create something that works for everyone, not just the average case.</p><h3>Exercise: Audit Your Design Principles</h3><p>Look at a project you have built or are building. Write down the implicit principles that guided your decisions. Then ask: <em>Are these the right principles? What principle, if adopted, would most improve this project?</em></p><hr><h2>Module 3: Strategic Frameworks</h2><p>Frameworks are mental models that help you see patterns, make decisions, and communicate complex ideas simply. They are the tools in the architect's belt.</p><h3>The OODA Loop</h3><p>Observe, Orient, Decide, Act. Developed by military strategist John Boyd, the OODA loop is a framework for decision-making under uncertainty. The key insight: speed matters. The faster you can cycle through OODA, the more adaptive you become.</p><p><strong>Observe</strong> - Gather data from your environment. What is happening? What changed?</p><p><strong>Orient</strong> - Analyze the data through the lens of your experience, knowledge, and mental models. What does it mean?</p><p><strong>Decide</strong> - Choose a course of action based on your orientation. What will you do?</p><p><strong>Act</strong> - Execute your decision. Then observe the results and start the cycle again.</p><h3>First Principles Thinking</h3><p>Most people reason by analogy - they look at what others have done and adapt it. First principles thinking breaks problems down to their fundamental truths and builds up from there.</p><p>Elon Musk on first principles: <em>"It is important to view knowledge as sort of a semantic tree - make sure you understand the fundamental principles, the trunk and big branches, before you get into the leaves/details."</em></p><p>To use first principles: identify and challenge your assumptions, break the problem down to its basic elements, and reconstruct a solution from the ground up.</p><h3>The Cynefin Framework</h3><p>Not all problems are the same. Cynefin helps you categorize problems so you can apply the right approach:</p><p><strong>Clear</strong> - Cause and effect are obvious. Apply best practices.</p><p><strong>Complicated</strong> - Cause and effect require analysis. Consult experts.</p><p><strong>Complex</strong> - Cause and effect can only be understood in retrospect. Experiment and probe.</p><p><strong>Chaotic</strong> - Cause and effect are unclear. Act quickly to stabilize, then move to complex.</p><p><strong>Disorder</strong> - You do not know which domain you are in. This is the danger zone - classify first, then act.</p><h3>Exercise: Map a Decision</h3><p>Think of a recent difficult decision you made. Map it through the OODA loop. Where did you spend most of your time? Where did you get stuck? Then classify the problem using Cynefin. Was your approach appropriate for the domain?</p><hr><h2>Module 4: Execution and Systems</h2><p>A blueprint without execution is a dream. Execution without a blueprint is chaos. Module 4 brings it all together - turning architectural thinking into action.</p><h3>The Execution Gap</h3><p>Between the blueprint and the building is the execution gap. This is where most projects fail. Not because the idea was bad, but because the execution was poor. Closing the execution gap requires three things: clarity, commitment, and feedback.</p><p><strong>Clarity</strong> - Everyone involved must know exactly what to do and why. Ambiguity is the enemy of execution.</p><p><strong>Commitment</strong> - Without commitment, the plan is just words. Commitment means resources allocated, deadlines set, and accountability assigned.</p><p><strong>Feedback</strong> - You cannot execute in the dark. You need systems that tell you whether you are on track, off track, or ahead.</p><h3>Building Execution Systems</h3><p>Systems are the difference between a one-time success and sustained achievement. A system is a repeatable process that produces a consistent result.</p><p>Key elements of an execution system:</p><p><strong>1. Triggers</strong> - What starts the process? A trigger could be a time (every Monday), an event (a new customer signs up), or a condition (inventory drops below threshold).</p><p><strong>2. Workflow</strong> - What are the steps? Who does what, in what order, with what tools? Document the workflow so it can be repeated and improved.</p><p><strong>3. Feedback Loops</strong> - How do you know it is working? Build in metrics, checkpoints, and reviews. Feedback loops allow you to course-correct before small problems become big ones.</p><p><strong>4. Improvement Cycles</strong> - No system is perfect. Build in regular intervals for reflection and refinement. The Japanese concept of kaizen - continuous improvement - applies to systems as much as to products.</p><h3>The Architect's Discipline</h3><p>Architectural Thinking is not a one-time exercise. It is a discipline - a way of approaching every project, every problem, every decision. The architect does not stop thinking when the blueprint is done. The architect stays with the building, observing, adjusting, and improving.</p><p>As you go forward, remember:</p><ul><li>Start with the blueprint, not the bricks.</li><li>Let principles guide your decisions.</li><li>Use frameworks to see clearly.</li><li>Build systems that execute for you.</li></ul><h3>Final Exercise: Your Architectural Portfolio</h3><p>Go back to the project you blueprinted in Module 1. Apply the design principles from Module 2. Run it through the strategic frameworks from Module 3. Design an execution system using Module 4. You now have a complete architectural plan - from blueprint to execution.</p><p>You are no longer just a builder. You are an architect.</p>', 2)`
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

