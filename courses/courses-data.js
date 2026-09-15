/* global window */
/* ─────────────────────────────────────────────────────────────
   COURSE DATA — the single source of truth for course content.
   Add a new course by appending an object to the `courses` array.
   The homepage, /courses/ catalog, and course pages all render
   from this file. Fill in the content below when ready.
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
    }
  ]
};