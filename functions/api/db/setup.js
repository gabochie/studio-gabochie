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
      `DELETE FROM tasks WHERE id NOT IN (SELECT MIN(id) FROM tasks GROUP BY title)`,
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
      `ALTER TABLE page_views ADD COLUMN device_type TEXT DEFAULT ''`,
      `ALTER TABLE page_views ADD COLUMN user_agent TEXT DEFAULT ''`,
      `ALTER TABLE page_views ADD COLUMN source TEXT DEFAULT ''`,
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
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_title ON tasks(title)`,
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
        ('Systems Thinking in Genesis', 'systems-thinking-genesis', 'Biblical Foundations of Systems Thinking', 'Explore the book of Genesis through a systems thinking lens. See creation, the fall, the patriarchs, and the exodus as interconnected systems with feedback loops, leverage points, and emergent properties.', 'Self-paced', 0, 'Free', 'active', '<h2>Welcome to Systems Thinking in Genesis</h2><p>The Bible is the source of all true knowledge and wisdom. <em>"The fear of the Lord is the beginning of wisdom"</em> (Proverbs 9:10). In this program, we study Genesis as the foundation for systems thinking — not as a textbook illustration, but as divine revelation. Every system concept we explore exists because God built it into creation first. Let Scripture be your teacher.</p>', '<h2>Full Curriculum: Systems Thinking in Genesis</h2><p>Why does Genesis reveal systems thinking? Because God Himself is the ultimate designer, and He built order, interdependence, and purpose into creation. As Paul writes, <em>"For since the creation of the world God''s invisible qualities — His eternal power and divine nature — have been clearly seen, being understood from what has been made"</em> (Romans 1:20). The patterns we observe in Scripture are not accidental — they reflect the mind of the Creator.</p><p>This course explores Genesis as a case study in systems thinking, but with a crucial difference: <strong>Scripture is not the illustration — it is the source.</strong> Every systems concept we encounter exists because God first built it into His creation, His covenants, and His redemptive plan. Each module opens with a passage of Scripture, draws the system concept from it, and then helps you apply it.</p><hr><h2>Module 1: Creation as a System</h2><h3>Read Genesis 1:1-31</h3><p><strong>Key Idea: Interdependence and Nested Hierarchy</strong></p><p>Before you study systems thinking, study the first system: creation itself. Genesis 1 does not present a random sequence. Each day prepares the environment for what follows.</p><p><strong>Day 1</strong> — Light (Genesis 1:3-5). Light makes photosynthesis possible, which sustains all plant life. <strong>Day 2</strong> — The sky and waters (Genesis 1:6-8). The water cycle governs weather and agriculture. <strong>Day 3</strong> — Land and vegetation (Genesis 1:9-13). Plants produce oxygen and food. <strong>Day 4</strong> — Sun, moon, and stars (Genesis 1:14-19). They govern seasons and rhythms. <strong>Day 5</strong> — Sea creatures and birds (Genesis 1:20-23). They populate their domains. <strong>Day 6</strong> — Land animals and humanity (Genesis 1:24-31). They inherit a fully functioning ecosystem.</p><p>This is a <strong>nested hierarchy</strong>: each level contains and enables the next. In Proverbs, we see this principle: <em>"The earth, which is established forever"</em> (Proverbs 3:19) — God established creation with layers of wisdom.</p><h3>What Scripture Teaches About Systems</h3><ul><li><strong>Interdependence</strong> — No element exists in isolation. Each day depends on the days before it. Paul later explains: <em>"The body is a unit, though it is composed of many parts"</em> (1 Corinthians 12:12).</li><li><strong>Emergence</strong> — The whole creation is greater than the sum of its parts. Genesis 1:31 declares it <em>"very good."</em></li><li><strong>Order and Purpose</strong> — God does nothing without design. <em>"He has made everything beautiful in its time"</em> (Ecclesiastes 3:11).</li></ul><h3>Application Exercise</h3><p>Read Genesis 1 again. Identify one created thing (light, water, plants, animals). Trace how it depends on what came before it and enables what comes after. How does this change how you see your role in God''s creation?</p><hr><h2>Module 2: Patterns in the Patriarchs</h2><h3>Read Genesis 12:1-9; 15:1-6; 21:1-7; 22:1-18; 25:19-34; 27:1-45; 32:22-32</h3><p><strong>Key Idea: Reinforcing and Balancing Feedback Loops</strong></p><p>Scripture shows us that human behavior follows patterns. The lives of Abraham, Isaac, and Jacob are filled with recurring structures: promise, waiting, failure, rescue, blessing. These are not just stories — they are <strong>feedback loops</strong> that God uses to shape His covenant people.</p><p>A <strong>reinforcing feedback loop</strong> amplifies change. When God promises Abraham descendants (Genesis 12:2-3), and Abraham believes (Genesis 15:6), each act of faith strengthens the next. Hebrews 11 traces this loop through generations.</p><p>A <strong>balancing feedback loop</strong> resists change. When the patriarchs stray — Abraham lies about Sarah (Genesis 20), Jacob deceives Isaac (Genesis 27) — consequences bring them back into alignment. God uses discipline to correct course: <em>"The Lord disciplines the one He loves"</em> (Hebrews 12:6).</p><h3>What Scripture Teaches About Feedback</h3><ul><li><strong>Reinforcing Loops</strong> — Abraham''s faith led to blessing, which reinforced faith. Jesus says: <em>"Whoever has will be given more"</em> (Matthew 13:12).</li><li><strong>Balancing Loops</strong> — Consequences maintain alignment with covenant. <em>"Do not be deceived: God cannot be mocked. A man reaps what he sows"</em> (Galatians 6:7).</li><li><strong>Delayed Feedback</strong> — Abraham waited 25 years for Isaac. The Israelites waited 400 years in Egypt. Delayed feedback tests faith: <em>"The Lord is not slow in keeping His promise"</em> (2 Peter 3:9).</li><li><strong>Pattern Recognition</strong> — Scripture calls us to recognize recurring structures: <em>"These things happened to them as examples and were written down as warnings for us"</em> (1 Corinthians 10:11).</li></ul><h3>Application Exercise</h3><p>Read Abraham''s story in Genesis 12-22. Identify one reinforcing loop (something that grew stronger with each step of faith) and one balancing loop (something that corrected or redirected him). How do these same loops operate in your walk with God?</p><hr><h2>Module 3: Joseph''s Economic System</h2><h3>Read Genesis 41:1-57</h3><p><strong>Key Idea: Anticipatory Governance and Stock-and-Flow Dynamics</strong></p><p>Joseph''s management of Egypt''s seven years of abundance and seven years of famine is not just a history lesson — it is a divinely-inspired case study in <strong>anticipatory governance</strong>. God Himself reveals the pattern through Pharaoh''s dreams (Genesis 41:25-32). The system concept comes from God before Joseph implements it.</p><p>In <strong>stocks and flows</strong> language: grain is the <strong>stock</strong>. The <strong>inflow</strong> is the abundant harvest. The <strong>outflow</strong> is consumption during famine. Joseph increased the stock by storing grain during inflow (Genesis 41:48-49) and controlled outflow by rationing (Genesis 41:53-57).</p><p>Scripture repeatedly teaches this principle: <em>"The wise store up choice food and olive oil, but fools gulp theirs down"</em> (Proverbs 21:20). Joseph was wise because God gave him wisdom (Genesis 41:39).</p><h3>What Scripture Teaches About Stewardship</h3><ul><li><strong>Stocks and Flows</strong> — Accumulate during abundance for use during scarcity. Proverbs 6:6-8 points to the ant: <em>"It stores its provisions in summer and gathers its food at harvest."</em></li><li><strong>Leverage Points</strong> — Storage capacity changed Egypt''s resilience. Proverbs 27:23-27 instructs shepherds to know the condition of their flocks.</li><li><strong>God as Source</strong> — Joseph credits God: <em>"God has revealed to Pharaoh what He is about to do"</em> (Genesis 41:28). All economic wisdom begins with the fear of the Lord (Proverbs 1:7).</li><li><strong>Resilience Through Wisdom</strong> — Egypt not only survived but became a storehouse for surrounding nations. <em>"The blessing of the Lord brings wealth, without painful toil for it"</em> (Proverbs 10:22).</li></ul><h3>Application Exercise</h3><p>Read Proverbs 6:6-8 and Genesis 41. What is one <em>stock</em> God has entrusted to you (savings, knowledge, relationships, time)? What are its inflows and outflows? How can you build buffer capacity before a season of scarcity?</p><hr><h2>Module 4: The Exodus as a Feedback Loop</h2><h3>Read Exodus 1:1-14; 3:7-10; 7:1-12:51; 14:1-31; 20:1-21</h3><p><strong>Key Idea: Reinforcing Feedback Loops of Liberation</strong></p><p>The Exodus is God''s great deliverance, and it follows a <strong>reinforcing feedback loop</strong>: Cry Out → God Hears → Deliverance → Covenant → Worship. Each cycle builds on the last, and at each stage God reveals more of His character.</p><p>The ten plagues (Exodus 7-12) target specific Egyptian systems: the Nile (water, Exodus 7:14-24), livestock (agriculture, Exodus 9:1-7), crops (food, Exodus 9:13-35, 10:1-20), firstborn (social order, Exodus 11:1-12:30). Each plague is a <strong>feedback signal</strong> from the Creator that the Egyptian system is built on injustice. Pharaoh''s resistance paradoxically creates conditions for greater liberation — Scripture even says God hardened Pharaoh''s heart to display His power (Exodus 9:16, Romans 9:17).</p><p>This is a sobering truth: suppression of God''s people creates a reinforcing loop that leads to greater freedom.</p><h3>What Scripture Teaches About Liberation</h3><ul><li><strong>Reinforcing Loop</strong> — Each plague escalated because Pharaoh resisted. Resistance strengthened God''s deliverance.</li><li><strong>Leverage Points</strong> — The Passover (Exodus 12) was the ultimate leverage point — the blood on the doorposts shifted the entire system.</li><li><strong>Emergence</strong> — A group of slaves becomes a nation at Sinai (Exodus 19-20). God forms Israel into a kingdom of priests.</li><li><strong>Unintended Consequences</strong> — Trying to suppress God''s people only accelerates His plan. <em>"The more they were oppressed, the more they multiplied"</em> (Exodus 1:12).</li></ul><h3>Application Exercise</h3><p>Read Exodus 1:8-22 and 3:7-10. Pharaoh tried to solve a ''problem'' (a growing Hebrew population) by increasing oppression. But his solution made the ''problem'' worse. Identify an area in your life where your solution is making the problem worse. What would a God-centered leverage point look like instead?</p><hr><p><strong>Continue to the next module when ready.</strong> Each module builds on the previous one, and all are rooted in the truth that <em>"All Scripture is God-breathed and is useful for teaching, rebuking, correcting and training in righteousness"</em> (2 Timothy 3:16).</p>', 3),
        ('Introduction to Design Thinking from Genesis', 'intro-design-thinking', 'The Original Design Blueprint — Learning from the Creator', 'Design thinking is often called human-centered design. But the first designer was not human — it was God. Genesis reveals that God designed with intentionality, iteration, form, function, and purpose long before any design methodology existed. This program teaches the fundamentals of design thinking (empathize, define, ideate, prototype, test) by grounding each phase in Scripture. You will learn to design as God designs — with creativity, purpose, and love for the people you serve.', 'Self-paced', 0, 'Free', 'coming_soon', '<h2>Coming Soon: Introduction to Design Thinking</h2><p>This program is currently in development. We are crafting a practical introduction to design thinking rooted in Scripture — where every design principle is grounded in God''s character and His creation.</p><p>In the meantime, explore <a href="/school/">Systems Thinking in Genesis</a> to start your learning journey.</p>', '', 4),
        ('Design Thinking in Genesis \u2013 The Creation', 'design-thinking-genesis', 'The Original Design Blueprint \u2014 God as the First Designer', 'Discover how the Genesis creation account reveals the ultimate design thinking process. From the separation of light from darkness (Genesis 1:3-4) to the creation of humanity in God''s image (Genesis 1:26-28), every step follows divine design methodology. God empathized with His creation, defined purpose for each element, ideated through spoken word, prototyped through the six days, and saw that it was very good (Genesis 1:31). This program explores each design phase through Scripture, showing that human creativity is a reflection of our Creator.', 'Self-paced', 0, 'Free', 'coming_soon', '<h2>Coming Soon: Design Thinking in Genesis</h2><p>This program is currently in development. We are exploring how the Genesis creation account reveals the original design thinking process — intentionality, iteration, form and function, and stewardship as design — all rooted in God''s character as the Creator.</p><p>In the meantime, explore <a href="/school/">Systems Thinking in Genesis</a> to start your learning journey.</p>', '', 5),
        ('Introduction to Biomimicry', 'intro-biomimicry', 'Learning from the Creator Through Creation', 'Biomimicry is the practice of learning from nature''s patterns and strategies to solve human problems. But the Bible teaches that nature reveals the wisdom of God: <em>"Ask the beasts, and they will teach you"</em> (Job 12:7-10). Go to the ant, you sluggard; consider its ways and be wise (Proverbs 6:6). This program explores how God''s creation — from ants to eagles, from water cycles to honeycombs — contains design solutions that reflect the intelligence of the Creator. Every natural pattern is a lesson from God waiting to be discovered.', 'Self-paced', 0, 'Free', 'coming_soon', '<h2>Coming Soon: Introduction to Biomimicry</h2><p>This program is currently in development. We are building a journey into biomimicry rooted in Scripture — learning from nature''s genius as a reflection of the Creator''s wisdom (Job 12:7-10, Proverbs 6:6).</p><p>In the meantime, explore <a href="/school/">Systems Thinking in Genesis</a> to start your learning journey.</p>', '', 6),
        ('Introduction to Geometry', 'intro-geometry', 'The Language of the Creator', 'God created the universe with measure, number, and weight (Wisdom of Solomon 11:20). Geometry is not a human invention — it is the language God used to order creation. From the circle of the earth (Isaiah 40:22) to the measurements of the tabernacle (Exodus 25-27) and the New Jerusalem (Revelation 21:15-17), Scripture is filled with geometric truth. This program takes you on a foundational journey through geometry — from the simplest dot to complex planes and forms — showing that every shape and pattern reflects the order of the Creator.', 'Self-paced', 0, 'Free', 'coming_soon', '<h2>Coming Soon: Introduction to Geometry</h2><p>This program is currently in development. We are building a foundational journey through geometry — from the dot to planes and forms — rooted in the truth that God created all things with measure, number, and order (Isaiah 40:22, Revelation 21:15-17).</p><p>In the meantime, explore <a href="/school/">Systems Thinking in Genesis</a> to start your learning journey.</p>', '', 7),
        ('Introduction to Computing', 'intro-computing', 'The Logos and the Machine', 'In the beginning was the Word (Logos), and the Word was with God, and the Word was God (John 1:1). The Greek word Logos means not just word but reason, logic, and the rational principle that orders the universe. Computing — at its core — is the study of logic, information, and order. This program introduces the fundamentals of computing (hardware, software, binary logic, networks) while grounding every concept in the truth that all logic and information originate from God, who is the ultimate source of truth and order (Colossians 1:16-17).', 'Self-paced', 0, 'Free', 'coming_soon', '<h2>Coming Soon: Introduction to Computing</h2><p>This program is currently in development. We are creating a clear, accessible introduction to how computers work — rooted in the truth that all logic and information originate from God, the Logos (John 1:1, Colossians 1:16-17).</p><p>In the meantime, explore <a href="/school/">Systems Thinking in Genesis</a> to start your learning journey.</p>', '', 8),
        ('Introduction to Storytelling & Narrative Design', 'intro-storytelling', 'The Art of Shaping Meaning — From Genesis to Revelation', 'God is the original storyteller. Scripture unfolds as a single grand narrative: Creation, Fall, Redemption, Restoration. Jesus Himself taught in parables (Matthew 13), using story to reveal deep truth. This program teaches narrative structure, character arcs, metaphor, and oral tradition — from the parables of Jesus to the epic arcs of Genesis and Revelation. You will learn to craft stories that inform, inspire, and transform, because storytelling is not just a skill — it is a reflection of the God who spoke the world into being and wrote history itself.', 'Self-paced', 0, 'Free', 'coming_soon', '<h2>Coming Soon: Storytelling & Narrative Design</h2><p>This program is currently in development. We are crafting a deep exploration of narrative — from the parables of Jesus to the grand arc of Scripture — so you can learn to tell stories that inform, inspire, and transform.</p><p>In the meantime, explore <a href="/school/">Systems Thinking in Genesis</a> to start your learning journey.</p>', '', 9)
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
      // Update existing programs with Bible-centered content
      `UPDATE programs SET tagline = 'Biblical Foundations of Systems Thinking', sample_content = '<h2>Welcome to Systems Thinking in Genesis</h2><p>The Bible is the source of all true knowledge and wisdom. <em>"The fear of the Lord is the beginning of wisdom"</em> (Proverbs 9:10). In this program, we study Genesis as the foundation for systems thinking — not as a textbook illustration, but as divine revelation. Every system concept we explore exists because God built it into creation first. Let Scripture be your teacher.</p>', full_content = '<h2>Full Curriculum: Systems Thinking in Genesis</h2><p>Why does Genesis reveal systems thinking? Because God Himself is the ultimate designer, and He built order, interdependence, and purpose into creation. As Paul writes, <em>"For since the creation of the world God''s invisible qualities — His eternal power and divine nature — have been clearly seen, being understood from what has been made"</em> (Romans 1:20). The patterns we observe in Scripture are not accidental — they reflect the mind of the Creator.</p><p>This course explores Genesis as a case study in systems thinking, but with a crucial difference: <strong>Scripture is not the illustration — it is the source.</strong> Every systems concept we encounter exists because God first built it into His creation, His covenants, and His redemptive plan. Each module opens with a passage of Scripture, draws the system concept from it, and then helps you apply it.</p><hr><h2>Module 1: Creation as a System</h2><h3>Read Genesis 1:1-31</h3><p><strong>Key Idea: Interdependence and Nested Hierarchy</strong></p><p>Before you study systems thinking, study the first system: creation itself. Genesis 1 does not present a random sequence. Each day prepares the environment for what follows.</p><p><strong>Day 1</strong> — Light (Genesis 1:3-5). Light makes photosynthesis possible, which sustains all plant life. <strong>Day 2</strong> — The sky and waters (Genesis 1:6-8). The water cycle governs weather and agriculture. <strong>Day 3</strong> — Land and vegetation (Genesis 1:9-13). Plants produce oxygen and food. <strong>Day 4</strong> — Sun, moon, and stars (Genesis 1:14-19). They govern seasons and rhythms. <strong>Day 5</strong> — Sea creatures and birds (Genesis 1:20-23). They populate their domains. <strong>Day 6</strong> — Land animals and humanity (Genesis 1:24-31). They inherit a fully functioning ecosystem.</p><p>This is a <strong>nested hierarchy</strong>: each level contains and enables the next. In Proverbs, we see this principle: <em>"The earth, which is established forever"</em> (Proverbs 3:19) — God established creation with layers of wisdom.</p><h3>What Scripture Teaches About Systems</h3><ul><li><strong>Interdependence</strong> — No element exists in isolation. Each day depends on the days before it. Paul later explains: <em>"The body is a unit, though it is composed of many parts"</em> (1 Corinthians 12:12).</li><li><strong>Emergence</strong> — The whole creation is greater than the sum of its parts. Genesis 1:31 declares it <em>"very good."</em></li><li><strong>Order and Purpose</strong> — God does nothing without design. <em>"He has made everything beautiful in its time"</em> (Ecclesiastes 3:11).</li></ul><h3>Application Exercise</h3><p>Read Genesis 1 again. Identify one created thing (light, water, plants, animals). Trace how it depends on what came before it and enables what comes after. How does this change how you see your role in God''s creation?</p><hr><h2>Module 2: Patterns in the Patriarchs</h2><h3>Read Genesis 12:1-9; 15:1-6; 21:1-7; 22:1-18; 25:19-34; 27:1-45; 32:22-32</h3><p><strong>Key Idea: Reinforcing and Balancing Feedback Loops</strong></p><p>Scripture shows us that human behavior follows patterns. The lives of Abraham, Isaac, and Jacob are filled with recurring structures: promise, waiting, failure, rescue, blessing. These are not just stories — they are <strong>feedback loops</strong> that God uses to shape His covenant people.</p><p>A <strong>reinforcing feedback loop</strong> amplifies change. When God promises Abraham descendants (Genesis 12:2-3), and Abraham believes (Genesis 15:6), each act of faith strengthens the next. Hebrews 11 traces this loop through generations.</p><p>A <strong>balancing feedback loop</strong> resists change. When the patriarchs stray — Abraham lies about Sarah (Genesis 20), Jacob deceives Isaac (Genesis 27) — consequences bring them back into alignment. God uses discipline to correct course: <em>"The Lord disciplines the one He loves"</em> (Hebrews 12:6).</p><h3>What Scripture Teaches About Feedback</h3><ul><li><strong>Reinforcing Loops</strong> — Abraham''s faith led to blessing, which reinforced faith. Jesus says: <em>"Whoever has will be given more"</em> (Matthew 13:12).</li><li><strong>Balancing Loops</strong> — Consequences maintain alignment with covenant. <em>"Do not be deceived: God cannot be mocked. A man reaps what he sows"</em> (Galatians 6:7).</li><li><strong>Delayed Feedback</strong> — Abraham waited 25 years for Isaac. The Israelites waited 400 years in Egypt. Delayed feedback tests faith: <em>"The Lord is not slow in keeping His promise"</em> (2 Peter 3:9).</li><li><strong>Pattern Recognition</strong> — Scripture calls us to recognize recurring structures: <em>"These things happened to them as examples and were written down as warnings for us"</em> (1 Corinthians 10:11).</li></ul><h3>Application Exercise</h3><p>Read Abraham''s story in Genesis 12-22. Identify one reinforcing loop (something that grew stronger with each step of faith) and one balancing loop (something that corrected or redirected him). How do these same loops operate in your walk with God?</p><hr><h2>Module 3: Joseph''s Economic System</h2><h3>Read Genesis 41:1-57</h3><p><strong>Key Idea: Anticipatory Governance and Stock-and-Flow Dynamics</strong></p><p>Joseph''s management of Egypt''s seven years of abundance and seven years of famine is not just a history lesson — it is a divinely-inspired case study in <strong>anticipatory governance</strong>. God Himself reveals the pattern through Pharaoh''s dreams (Genesis 41:25-32). The system concept comes from God before Joseph implements it.</p><p>In <strong>stocks and flows</strong> language: grain is the <strong>stock</strong>. The <strong>inflow</strong> is the abundant harvest. The <strong>outflow</strong> is consumption during famine. Joseph increased the stock by storing grain during inflow (Genesis 41:48-49) and controlled outflow by rationing (Genesis 41:53-57).</p><p>Scripture repeatedly teaches this principle: <em>"The wise store up choice food and olive oil, but fools gulp theirs down"</em> (Proverbs 21:20). Joseph was wise because God gave him wisdom (Genesis 41:39).</p><h3>What Scripture Teaches About Stewardship</h3><ul><li><strong>Stocks and Flows</strong> — Accumulate during abundance for use during scarcity. Proverbs 6:6-8 points to the ant: <em>"It stores its provisions in summer and gathers its food at harvest."</em></li><li><strong>Leverage Points</strong> — Storage capacity changed Egypt''s resilience. Proverbs 27:23-27 instructs shepherds to know the condition of their flocks.</li><li><strong>God as Source</strong> — Joseph credits God: <em>"God has revealed to Pharaoh what He is about to do"</em> (Genesis 41:28). All economic wisdom begins with the fear of the Lord (Proverbs 1:7).</li><li><strong>Resilience Through Wisdom</strong> — Egypt not only survived but became a storehouse for surrounding nations. <em>"The blessing of the Lord brings wealth, without painful toil for it"</em> (Proverbs 10:22).</li></ul><h3>Application Exercise</h3><p>Read Proverbs 6:6-8 and Genesis 41. What is one <em>stock</em> God has entrusted to you (savings, knowledge, relationships, time)? What are its inflows and outflows? How can you build buffer capacity before a season of scarcity?</p><hr><h2>Module 4: The Exodus as a Feedback Loop</h2><h3>Read Exodus 1:1-14; 3:7-10; 7:1-12:51; 14:1-31; 20:1-21</h3><p><strong>Key Idea: Reinforcing Feedback Loops of Liberation</strong></p><p>The Exodus is God''s great deliverance, and it follows a <strong>reinforcing feedback loop</strong>: Cry Out → God Hears → Deliverance → Covenant → Worship. Each cycle builds on the last, and at each stage God reveals more of His character.</p><p>The ten plagues (Exodus 7-12) target specific Egyptian systems: the Nile (water, Exodus 7:14-24), livestock (agriculture, Exodus 9:1-7), crops (food, Exodus 9:13-35, 10:1-20), firstborn (social order, Exodus 11:1-12:30). Each plague is a <strong>feedback signal</strong> from the Creator that the Egyptian system is built on injustice. Pharaoh''s resistance paradoxically creates conditions for greater liberation — Scripture even says God hardened Pharaoh''s heart to display His power (Exodus 9:16, Romans 9:17).</p><p>This is a sobering truth: suppression of God''s people creates a reinforcing loop that leads to greater freedom.</p><h3>What Scripture Teaches About Liberation</h3><ul><li><strong>Reinforcing Loop</strong> — Each plague escalated because Pharaoh resisted. Resistance strengthened God''s deliverance.</li><li><strong>Leverage Points</strong> — The Passover (Exodus 12) was the ultimate leverage point — the blood on the doorposts shifted the entire system.</li><li><strong>Emergence</strong> — A group of slaves becomes a nation at Sinai (Exodus 19-20). God forms Israel into a kingdom of priests.</li><li><strong>Unintended Consequences</strong> — Trying to suppress God''s people only accelerates His plan. <em>"The more they were oppressed, the more they multiplied"</em> (Exodus 1:12).</li></ul><h3>Application Exercise</h3><p>Read Exodus 1:8-22 and 3:7-10. Pharaoh tried to solve a ''problem'' (a growing Hebrew population) by increasing oppression. But his solution made the ''problem'' worse. Identify an area in your life where your solution is making the problem worse. What would a God-centered leverage point look like instead?</p><hr><p><strong>Continue to the next module when ready.</strong> Each module builds on the previous one, and all are rooted in the truth that <em>"All Scripture is God-breathed and is useful for teaching, rebuking, correcting and training in righteousness"</em> (2 Timothy 3:16).</p>' WHERE slug = 'systems-thinking-genesis'`,
      `UPDATE programs SET title = 'Introduction to Design Thinking from Genesis', tagline = 'The Original Design Blueprint — Learning from the Creator', description = 'Design thinking is often called human-centered design. But the first designer was not human — it was God. Genesis reveals that God designed with intentionality, iteration, form, function, and purpose long before any design methodology existed. This program teaches the fundamentals of design thinking (empathize, define, ideate, prototype, test) by grounding each phase in Scripture. You will learn to design as God designs — with creativity, purpose, and love for the people you serve.', sample_content = '<h2>Coming Soon: Introduction to Design Thinking</h2><p>This program is currently in development. We are crafting a practical introduction to design thinking rooted in Scripture — where every design principle is grounded in God''s character and His creation.</p><p>In the meantime, explore <a href="/school/">Systems Thinking in Genesis</a> to start your learning journey.</p>' WHERE slug = 'intro-design-thinking'`,
      `UPDATE programs SET tagline = 'The Original Design Blueprint \u2014 God as the First Designer', description = 'Discover how the Genesis creation account reveals the ultimate design thinking process. From the separation of light from darkness (Genesis 1:3-4) to the creation of humanity in God''s image (Genesis 1:26-28), every step follows divine design methodology. God empathized with His creation, defined purpose for each element, ideated through spoken word, prototyped through the six days, and saw that it was very good (Genesis 1:31). This program explores each design phase through Scripture, showing that human creativity is a reflection of our Creator.', sample_content = '<h2>Coming Soon: Design Thinking in Genesis</h2><p>This program is currently in development. We are exploring how the Genesis creation account reveals the original design thinking process — intentionality, iteration, form and function, and stewardship as design — all rooted in God''s character as the Creator.</p><p>In the meantime, explore <a href="/school/">Systems Thinking in Genesis</a> to start your learning journey.</p>' WHERE slug = 'design-thinking-genesis'`,
      `UPDATE programs SET tagline = 'Learning from the Creator Through Creation', description = 'Biomimicry is the practice of learning from nature''s patterns and strategies to solve human problems. But the Bible teaches that nature reveals the wisdom of God: <em>"Ask the beasts, and they will teach you"</em> (Job 12:7-10). Go to the ant, you sluggard; consider its ways and be wise (Proverbs 6:6). This program explores how God''s creation — from ants to eagles, from water cycles to honeycombs — contains design solutions that reflect the intelligence of the Creator. Every natural pattern is a lesson from God waiting to be discovered.', sample_content = '<h2>Coming Soon: Introduction to Biomimicry</h2><p>This program is currently in development. We are building a journey into biomimicry rooted in Scripture — learning from nature''s genius as a reflection of the Creator''s wisdom (Job 12:7-10, Proverbs 6:6).</p><p>In the meantime, explore <a href="/school/">Systems Thinking in Genesis</a> to start your learning journey.</p>' WHERE slug = 'intro-biomimicry'`,
      `UPDATE programs SET tagline = 'The Language of the Creator', description = 'God created the universe with measure, number, and weight (Wisdom of Solomon 11:20). Geometry is not a human invention — it is the language God used to order creation. From the circle of the earth (Isaiah 40:22) to the measurements of the tabernacle (Exodus 25-27) and the New Jerusalem (Revelation 21:15-17), Scripture is filled with geometric truth. This program takes you on a foundational journey through geometry — from the simplest dot to complex planes and forms — showing that every shape and pattern reflects the order of the Creator.', sample_content = '<h2>Coming Soon: Introduction to Geometry</h2><p>This program is currently in development. We are building a foundational journey through geometry — from the dot to planes and forms — rooted in the truth that God created all things with measure, number, and order (Isaiah 40:22, Revelation 21:15-17).</p><p>In the meantime, explore <a href="/school/">Systems Thinking in Genesis</a> to start your learning journey.</p>' WHERE slug = 'intro-geometry'`,
      `UPDATE programs SET tagline = 'The Logos and the Machine', description = 'In the beginning was the Word (Logos), and the Word was with God, and the Word was God (John 1:1). The Greek word Logos means not just word but reason, logic, and the rational principle that orders the universe. Computing — at its core — is the study of logic, information, and order. This program introduces the fundamentals of computing (hardware, software, binary logic, networks) while grounding every concept in the truth that all logic and information originate from God, who is the ultimate source of truth and order (Colossians 1:16-17).', sample_content = '<h2>Coming Soon: Introduction to Computing</h2><p>This program is currently in development. We are creating a clear, accessible introduction to how computers work — rooted in the truth that all logic and information originate from God, the Logos (John 1:1, Colossians 1:16-17).</p><p>In the meantime, explore <a href="/school/">Systems Thinking in Genesis</a> to start your learning journey.</p>' WHERE slug = 'intro-computing'`,
      `UPDATE programs SET tagline = 'The Art of Shaping Meaning — From Genesis to Revelation', description = 'God is the original storyteller. Scripture unfolds as a single grand narrative: Creation, Fall, Redemption, Restoration. Jesus Himself taught in parables (Matthew 13), using story to reveal deep truth. This program teaches narrative structure, character arcs, metaphor, and oral tradition — from the parables of Jesus to the epic arcs of Genesis and Revelation. You will learn to craft stories that inform, inspire, and transform, because storytelling is not just a skill — it is a reflection of the God who spoke the world into being and wrote history itself.', sample_content = '<h2>Coming Soon: Storytelling & Narrative Design</h2><p>This program is currently in development. We are crafting a deep exploration of narrative — from the parables of Jesus to the grand arc of Scripture — so you can learn to tell stories that inform, inspire, and transform.</p><p>In the meantime, explore <a href="/school/">Systems Thinking in Genesis</a> to start your learning journey.</p>' WHERE slug = 'intro-storytelling'`,
      // Update existing Architectural Thinking program with full content
      `UPDATE programs SET status = 'coming_soon', tagline = 'From Blueprint to Masterpiece', sample_content = '<h2>Coming Soon: Architectural Thinking Program</h2><p>This program is currently in development. We are crafting a complete curriculum on thinking like an architect — from blueprint thinking to strategic frameworks and execution systems.</p><p>In the meantime, explore <a href="/school/">Systems Thinking in Genesis</a> to start your learning journey.</p>', full_content = '' WHERE slug = 'architectural-thinking'`,
      `INSERT OR IGNORE INTO programs (title, slug, tagline, description, duration, price, price_label, status, sample_content, full_content, sort_order) VALUES ('Systems Thinking Program', 'systems-thinking', 'See the whole. Solve the root. Design the future.', 'Understand the hidden patterns that shape our world. This program teaches you to see interconnected systems, anticipate ripple effects, and design solutions that actually work - whether in business, society, or your personal life. Through case studies, mental models, and practical exercises, you will develop the lens of a systems thinker.', 'Self-paced', 250, 'Free Sample · Full Access GH¢ 250', 'coming_soon', '<h2>Welcome to the Systems Thinking Program</h2><p>Before we dive into the models, let us start with a simple exercise. Look around you right now. Pick one problem - in your work, your community, or your life - and ask: <em>What keeps this problem in place?</em></p><p>That is the first step. Systems thinking begins not with answers, but with better questions.</p><h3>Your First Tool: The Iceberg Model</h3><p>Most people react to events. Systems thinkers look deeper:</p><ul><li><strong>Events</strong> - What happened? (the tip)</li><li><strong>Patterns</strong> - What has been happening over time?</li><li><strong>Structure</strong> - What forces are driving these patterns?</li><li><strong>Mental Models</strong> - What beliefs keep this structure in place?</li></ul><p>For the full program, you will get video walkthroughs, real-world case studies, worksheets, and community exercises.</p>', '', 1), ('Architectural Thinking Program', 'architectural-thinking', 'From Blueprint to Masterpiece', 'Learn to think like an architect - structuring ideas, projects, and systems with clarity and purpose. This program covers mental models, design principles, and strategic frameworks for building anything that matters. From blueprints to execution, you will learn how to design solutions that stand the test of time.', 'Self-paced', 0, 'Free', 'coming_soon', '<h2>Welcome to the Architectural Thinking Program</h2><p>Architects do not build by accident. Before a single brick is laid, they have a plan - a blueprint that accounts for structure, load, flow, and beauty. Architectural Thinking applies this same discipline to ideas, projects, and systems.</p><p>This program will teach you to think like an architect: to see the whole before the parts, to design with principles instead of impulses, and to build things that last.</p><h3>What You Will Learn</h3><ul><li><strong>Module 1: Blueprint Thinking</strong> - How to structure ideas and projects with clarity and purpose</li><li><strong>Module 2: Design Principles</strong> - Core principles for building anything that matters</li><li><strong>Module 3: Strategic Frameworks</strong> - Mental models for strategic planning</li><li><strong>Module 4: Execution and Systems</strong> - From blueprint to reality</li></ul><p>Start with Module 1 below.</p>', '<h2>Module 1: Blueprint Thinking</h2><p>Every great building starts with a blueprint. Not a sketch. Not a vague idea. A detailed plan that accounts for every beam, every load, every flow of people and energy. Blueprint Thinking applies this same rigor to your ideas and projects.</p><h3>Why Blueprint First?</h3><p>Most people start with execution. They jump into building without a plan, mistaking motion for progress. The result is rework, waste, and collapse.</p><p>Blueprint Thinking reverses this. You invest time upfront in thinking so you save time十倍 in doing. As the architect Daniel Burnham said: <em>"Make no little plans. They have no magic to stir men''s blood."</em></p><h3>The Four Questions of Blueprint Thinking</h3><p>Before any project, ask these four questions:</p><p><strong>1. What are we building?</strong> - Define the output with clarity. A website? A team? A movement? A product? Be specific. A vague output produces a vague result.</p><p><strong>2. Why does it exist?</strong> - What purpose does it serve? What problem does it solve? What need does it meet? Purpose is the foundation. Without it, the structure has no reason to stand.</p><p><strong>3. Who is it for?</strong> - Who will use it, live in it, or be affected by it? Every architectural decision should serve the user. If you do not know who you are building for, you are building for yourself.</p><p><strong>4. How will it hold together?</strong> - What is the structural logic? How do the parts relate to the whole? What are the dependencies, the flows, the load-bearing elements?</p><h3>Exercise: Your First Blueprint</h3><p>Take a project you are currently working on - or one you have been procrastinating on. Write a one-page blueprint that answers the four questions above. Do not start execution until the blueprint is complete.</p><hr><h2>Module 2: Design Principles</h2><p>Principles are not rules. Rules tell you what to do. Principles tell you how to think. When you have strong principles, you do not need rules - because you can reason from first principles in any situation.</p><h3>Principle 1: Form Follows Function</h3><p>The shape of anything should be determined by its purpose. A chair looks like a chair because it is designed for sitting. A bridge looks like a bridge because it is designed for crossing. When you force function to follow form, you get style over substance.</p><p>Ask: <em>Does the form of this project serve its function? Or am I choosing form for its own sake?</em></p><h3>Principle 2: Less is More</h3><p>Every addition is a subtraction. When you add a feature, a page, a step, or a rule, you subtract from clarity, speed, and focus. The best designs are not the ones with the most features - they are the ones with the fewest, most essential features executed well.</p><p>The architect Ludwig Mies van der Rohe said: <em>"Less is more."</em> This does not mean minimalism for its own sake. It means that every element must earn its place.</p><h3>Principle 3: Strength Through Structure</h3><p>A building is only as strong as its structure. The same is true for organizations, projects, and systems. Invest in the structure - the relationships, the workflows, the feedback loops - and the surface will take care of itself.</p><p>Ask: <em>What is holding this together? Is the structure strong enough to handle stress and change?</em></p><h3>Principle 4: Design for the Edge Cases</h3><p>The best designs break gracefully. They account for failure, not just success. When you design for the edge cases - the worst-case scenario, the unexpected user, the system under stress - you create something that works for everyone, not just the average case.</p><h3>Exercise: Audit Your Design Principles</h3><p>Look at a project you have built or are building. Write down the implicit principles that guided your decisions. Then ask: <em>Are these the right principles? What principle, if adopted, would most improve this project?</em></p><hr><h2>Module 3: Strategic Frameworks</h2><p>Frameworks are mental models that help you see patterns, make decisions, and communicate complex ideas simply. They are the tools in the architect''s belt.</p><h3>The OODA Loop</h3><p>Observe, Orient, Decide, Act. Developed by military strategist John Boyd, the OODA loop is a framework for decision-making under uncertainty. The key insight: speed matters. The faster you can cycle through OODA, the more adaptive you become.</p><p><strong>Observe</strong> - Gather data from your environment. What is happening? What changed?</p><p><strong>Orient</strong> - Analyze the data through the lens of your experience, knowledge, and mental models. What does it mean?</p><p><strong>Decide</strong> - Choose a course of action based on your orientation. What will you do?</p><p><strong>Act</strong> - Execute your decision. Then observe the results and start the cycle again.</p><h3>First Principles Thinking</h3><p>Most people reason by analogy - they look at what others have done and adapt it. First principles thinking breaks problems down to their fundamental truths and builds up from there.</p><p>Elon Musk on first principles: <em>"It is important to view knowledge as sort of a semantic tree - make sure you understand the fundamental principles, the trunk and big branches, before you get into the leaves/details."</em></p><p>To use first principles: identify and challenge your assumptions, break the problem down to its basic elements, and reconstruct a solution from the ground up.</p><h3>The Cynefin Framework</h3><p>Not all problems are the same. Cynefin helps you categorize problems so you can apply the right approach:</p><p><strong>Clear</strong> - Cause and effect are obvious. Apply best practices.</p><p><strong>Complicated</strong> - Cause and effect require analysis. Consult experts.</p><p><strong>Complex</strong> - Cause and effect can only be understood in retrospect. Experiment and probe.</p><p><strong>Chaotic</strong> - Cause and effect are unclear. Act quickly to stabilize, then move to complex.</p><p><strong>Disorder</strong> - You do not know which domain you are in. This is the danger zone - classify first, then act.</p><h3>Exercise: Map a Decision</h3><p>Think of a recent difficult decision you made. Map it through the OODA loop. Where did you spend most of your time? Where did you get stuck? Then classify the problem using Cynefin. Was your approach appropriate for the domain?</p><hr><h2>Module 4: Execution and Systems</h2><p>A blueprint without execution is a dream. Execution without a blueprint is chaos. Module 4 brings it all together - turning architectural thinking into action.</p><h3>The Execution Gap</h3><p>Between the blueprint and the building is the execution gap. This is where most projects fail. Not because the idea was bad, but because the execution was poor. Closing the execution gap requires three things: clarity, commitment, and feedback.</p><p><strong>Clarity</strong> - Everyone involved must know exactly what to do and why. Ambiguity is the enemy of execution.</p><p><strong>Commitment</strong> - Without commitment, the plan is just words. Commitment means resources allocated, deadlines set, and accountability assigned.</p><p><strong>Feedback</strong> - You cannot execute in the dark. You need systems that tell you whether you are on track, off track, or ahead.</p><h3>Building Execution Systems</h3><p>Systems are the difference between a one-time success and sustained achievement. A system is a repeatable process that produces a consistent result.</p><p>Key elements of an execution system:</p><p><strong>1. Triggers</strong> - What starts the process? A trigger could be a time (every Monday), an event (a new customer signs up), or a condition (inventory drops below threshold).</p><p><strong>2. Workflow</strong> - What are the steps? Who does what, in what order, with what tools? Document the workflow so it can be repeated and improved.</p><p><strong>3. Feedback Loops</strong> - How do you know it is working? Build in metrics, checkpoints, and reviews. Feedback loops allow you to course-correct before small problems become big ones.</p><p><strong>4. Improvement Cycles</strong> - No system is perfect. Build in regular intervals for reflection and refinement. The Japanese concept of kaizen - continuous improvement - applies to systems as much as to products.</p><h3>The Architect''s Discipline</h3><p>Architectural Thinking is not a one-time exercise. It is a discipline - a way of approaching every project, every problem, every decision. The architect does not stop thinking when the blueprint is done. The architect stays with the building, observing, adjusting, and improving.</p><p>As you go forward, remember:</p><ul><li>Start with the blueprint, not the bricks.</li><li>Let principles guide your decisions.</li><li>Use frameworks to see clearly.</li><li>Build systems that execute for you.</li></ul><h3>Final Exercise: Your Architectural Portfolio</h3><p>Go back to the project you blueprinted in Module 1. Apply the design principles from Module 2. Run it through the strategic frameworks from Module 3. Design an execution system using Module 4. You now have a complete architectural plan - from blueprint to execution.</p><p>You are no longer just a builder. You are an architect.</p>', 2)`
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

