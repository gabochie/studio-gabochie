/* global window */
/* ─────────────────────────────────────────────────────────────
   COURSE DATA — the single source of truth for course content.
   Add a new course by appending an object to the `courses` array.
   The homepage, /courses/ catalog, and course pages all render
   from this file. Fill in the content below when ready.
   Note: the /courses/ catalog also fetches /api/programs (the
   live DB) at runtime and merges it with this file — status and
   price here are the static fallback and should match the DB.
   ───────────────────────────────────────────────────────────── */
window.COURSE_DATA = {
  homepage: {
    // What the homepage hero promotes (the featured course slug)
    featured: 'systems-thinking'
  },
  courses: [
    {
      slug: 'systems-thinking',
      title: 'Systems Thinking for Vision Builders',
      tagline: 'Understand how things really work — then change them.',
      hasLandingPage: true,
      status: 'active',              // 'active' | 'coming_soon'
      price: 250,                    // GH¢ full-access price (0 = free)
      priceNote: 'Full access, one-time payment. Or start free with Module 1.',
      currency: 'GHS',
      duration: 'Self-paced',
      level: 'Beginner friendly',
      certification: 'Certificate of completion',
      // ── CONTENT (fill these in when ready) ──
      description: 'A practical course that teaches you to see the system behind every situation — the parts, the connections, the feedback loops, and the leverage points. You will learn to solve problems at the root instead of treating symptoms, and to build solutions that last.',
      outcomes: [
        'Describe a problem as a system — parts, connections, and boundaries',
        'Find the root cause behind recurring problems instead of chasing symptoms',
        'Use feedback loops and stocks-and-flows to predict ripple effects',
        'Identify high-leverage interventions that create lasting change',
        'Communicate complex situations clearly on one page (systems map)'
      ],
      modules: [
        { title: 'Module 1 — What Is a System?', summary: 'You already think in systems. This module names what you are doing and gives you the vocabulary.' },
        { title: 'Module 2 — Stocks, Flows, and Feedback', summary: 'The building blocks of every system, and why they matter for decisions.' },
        { title: 'Module 3 — Root Cause vs. Symptom', summary: 'Why fixes that look right often fail — and how to find the real lever.' },
        { title: 'Module 4 — Mapping a System', summary: 'Draw any situation as a one-page system map and see what others miss.' },
        { title: 'Module 5 — Leverage Points', summary: 'Where a small, well-placed change produces outsized results.' },
        { title: 'Module 6 — Systems in Life and Business', summary: 'Apply the lenses to family, work, church, and national development.' }
      ],
      whoItsFor: 'Vision builders — founders, creators, leaders, students, and anyone who wants to stop fixing symptoms and start shaping what lasts.',
      sampleIncludes: 'Module 1 free · no card required · progress saved to your dashboard',
      faqs: [
        { q: 'Do I need any experience?', a: 'None. Module 1 starts from first principles and builds up. ' },
        { q: 'How is the course delivered?', a: 'Self-paced modules in your personal dashboard, with checkpoints and a certificate when you finish.' },
        { q: 'What does “start free” mean?', a: 'Module 1 is free with no card. You pay only if you choose full access.' },
        { q: 'How do I pay?', a: 'Online via card, and Mobile Money options are orderable through the dashboard.' }
      ]
    },
    // ── Additional courses (catalog fallback) — full content in /api/programs ──
    {
      slug: 'guitar-method',
      title: 'Gideon Guitar Method',
      tagline: 'Learn guitar in weeks, not years.',
      status: 'active',
      price: 250,
      duration: 'Self-paced',
      level: 'Beginner friendly',
      description: 'A practical guitar method built for African learners — play real songs from day one.'
    },
    {
      slug: 'intro-design-thinking',
      title: 'Design Thinking for Vision Builders',
      tagline: 'A practical toolkit for solving real problems.',
      status: 'active',
      price: 0,
      duration: 'Self-paced',
      level: 'Beginner friendly',
      description: 'Empathize, define, ideate, prototype, test — and turn insight into ideas that work.'
    },
    {
      slug: 'pattern-recognition-vision-builders',
      title: 'Pattern Recognition for Vision Builders',
      tagline: 'See the patterns others miss.',
      status: 'active',
      price: 0,
      duration: 'Self-paced',
      level: 'Beginner friendly',
      description: 'Train your eye to spot recurring patterns in markets, behavior, and history — then act on them.'
    },
    {
      slug: 'architectural-thinking',
      title: 'Architectural Thinking for Vision Builders',
      tagline: 'Build ideas that stand.',
      status: 'active',
      price: 0,
      duration: 'Self-paced',
      level: 'Beginner friendly',
      description: 'Blueprint thinking, design principles, and execution systems for building anything that matters.'
    },
    {
      slug: 'web-development',
      title: 'Web Development for Ghanaians',
      tagline: 'Build websites for the world from Accra.',
      status: 'active',
      price: 150,
      duration: 'Self-paced',
      level: 'Beginner friendly',
      description: 'Learn to build and launch real websites — HTML, CSS, JavaScript and beyond.'
    },
    {
      slug: 'digital-marketing',
      title: 'Digital Marketing & Social Media',
      tagline: 'Grow an audience that pays.',
      status: 'active',
      price: 150,
      duration: 'Self-paced',
      level: 'Beginner friendly',
      description: 'Practical marketing for the Ghanaian market — content, ads, and community that convert.'
    },
    {
      slug: 'civic-intelligence',
      title: 'Civic Intelligence Certificate',
      tagline: 'Understand your rights. Shape your country.',
      status: 'active',
      price: 0,
      duration: 'Self-paced',
      level: 'Beginner friendly',
      description: 'The Constitution, civic tech, and how citizens can participate in governance and hold power to account.'
    },
    {
      slug: 'freelancing-ai',
      title: 'Freelancing with AI Tools',
      tagline: 'Earn online with AI-powered skills.',
      status: 'active',
      price: 150,
      duration: 'Self-paced',
      level: 'Beginner friendly',
      description: 'Combine AI tools with freelance skills to deliver services to clients anywhere in the world.'
    },
    {
      slug: 'ai-fundamentals',
      title: 'AI Fundamentals for Ghanaians',
      tagline: 'AI literacy with an African lens.',
      status: 'active',
      price: 0,
      duration: 'Self-paced',
      level: 'Beginner friendly',
      description: 'What AI is, how it works, and how it applies to agriculture, health, education, and governance in Ghana.'
    },
    {
      slug: 'essential-values',
      title: 'Essential Values for National Development',
      tagline: 'Values that build a nation.',
      status: 'active',
      price: 0,
      duration: 'Self-paced',
      level: 'Beginner friendly',
      description: 'Honesty, integrity, discipline, and citizenship — grounded in Ghanaian culture and Adinkra symbols.'
    },
    {
      slug: 'digital-entrepreneurship',
      title: 'Digital Entrepreneurship & the Creative Economy',
      tagline: 'Build a business that scales.',
      status: 'active',
      price: 0,
      duration: 'Self-paced',
      level: 'Beginner friendly',
      description: 'From idea to revenue — digital products, validation, and growth in the creative economy.'
    },
    {
      slug: 'youth-leadership',
      title: 'Youth Leadership & Community Organizing',
      tagline: 'Lead change where you are.',
      status: 'active',
      price: 0,
      duration: 'Self-paced',
      level: 'Beginner friendly',
      description: 'Organizing skills, communication, and project execution for young leaders.'
    },
    {
      slug: 'sketching-vision-builders',
      title: 'Sketching & Drawing for Vision Builders',
      tagline: 'Draw the future you imagine.',
      status: 'active',
      price: 0,
      duration: 'Self-paced',
      level: 'Beginner friendly',
      description: 'Practical sketching and drawing skills to help you visualize and share big ideas.'
    },
    {
      slug: 'systems-thinking-genesis',
      title: 'The Spirit of God in Genesis: Creativity, Wisdom & Love',
      tagline: 'Systems thinking through the lens of Genesis.',
      status: 'coming_soon',
      price: 250,
      duration: 'Self-paced',
      level: 'Beginner friendly',
      description: 'Explore creation, wisdom, and divine order through systems, design, and pattern-recognition lenses.'
    },
    {
      slug: 'revelation-study',
      title: 'The Spirit of God in Revelation: The Unveiling of Jesus Christ',
      tagline: 'Wisdom, love, and creativity in the last book.',
      status: 'coming_soon',
      price: 250,
      duration: 'Self-paced',
      level: 'Beginner friendly',
      description: 'A study of Revelation using systems thinking, creative thinking, and pattern recognition.'
    },
    {
      slug: 'psalms-worship-word',
      title: 'The Spirit of God in the Psalms: Worship, Wisdom & the Word',
      tagline: 'The Psalms through four lenses.',
      status: 'coming_soon',
      price: 250,
      duration: 'Self-paced',
      level: 'Beginner friendly',
      description: 'Wisdom, love, creativity, and pattern — a multi-lens walk through the Psalter.'
    },
    {
      slug: 'design-thinking-genesis',
      title: 'Design Thinking in Genesis – The Creation',
      tagline: 'God as the original designer.',
      status: 'coming_soon',
      price: 0,
      duration: 'Self-paced',
      level: 'Beginner friendly',
      description: 'See the creation account as a masterclass in design thinking.'
    },
    {
      slug: 'intro-biomimicry',
      title: 'Introduction to Biomimicry',
      tagline: 'Nature as mentor.',
      status: 'coming_soon',
      price: 0,
      duration: 'Self-paced',
      level: 'Beginner friendly',
      description: 'Innovation inspired by nature — from spirals and fractals to living systems.'
    },
    {
      slug: 'intro-geometry',
      title: 'Introduction to Geometry',
      tagline: 'The shapes behind everything.',
      status: 'coming_soon',
      price: 0,
      duration: 'Self-paced',
      level: 'Beginner friendly',
      description: 'Dots, lines, shapes, and space — geometry as a way of seeing the world.'
    },
    {
      slug: 'intro-computing',
      title: 'Introduction to Computing',
      tagline: 'Understand the machine.',
      status: 'coming_soon',
      price: 0,
      duration: 'Self-paced',
      level: 'Beginner friendly',
      description: 'How computers work — hardware, software, and the fundamentals of computation.'
    },
    {
      slug: 'intro-storytelling',
      title: 'Introduction to Storytelling & Narrative Design',
      tagline: 'Stories that stick.',
      status: 'coming_soon',
      price: 0,
      duration: 'Self-paced',
      level: 'Beginner friendly',
      description: 'Character, structure, voice, and metaphor — craft narratives across every medium.'
    }
  ]
};