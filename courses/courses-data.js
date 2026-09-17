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
    featured: 'systems-thinking',
    mission: 'You are not just here to live. You are here to create.',
    pillars: {
      creativity: 'What possibilities can I create?',
      love: 'Who and what am I creating for?',
      wisdom: 'What is worth creating?'
    },
    schools: [
      { slug: 'mind', label: 'Creative Mind', icon: 'ti-brain', blurb: 'How to think, imagine, solve problems and design ideas that work.' },
      { slug: 'love', label: 'Creative Love', icon: 'ti-heart-filled', blurb: 'How to create with others — relationships, communication, family and community.' },
      { slug: 'work', label: 'Creative Work', icon: 'ti-briefcase', blurb: 'How to create value, build skills and turn ideas into income.' },
      { slug: 'expression', label: 'Creative Expression', icon: 'ti-palette', blurb: 'How to make music, art, stories and things that move people.' },
      { slug: 'impact', label: 'Creative Impact', icon: 'ti-world', blurb: 'How to lead, build community and shape your country.' },
      { slug: 'wisdom', label: 'Wisdom Layer', icon: 'ti-bible', blurb: 'How to create with discernment — rooted in Scripture and truth.', isLayer: true }
    ]
  },
  courses: [
    {
      slug: 'systems-thinking',
      school: 'mind',
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
      school: 'expression',
      title: 'Gideon Guitar Method',
      tagline: 'Learn to play your favorite Ghanaian songs on guitar.',
      hasLandingPage: true,
      landingUrl: '/guitar/',
      status: 'active',
      price: 250,
      priceNote: 'Free bronze modules to start. Unlock silver and gold for full access.',
      currency: 'GHS',
      duration: 'Self-paced',
      level: 'Beginner friendly',
      certification: 'Song mastery portfolio',
      description: 'The fastest path from zero to your first Ghanaian song. 16 modules, 64 video lessons, real-time pitch detection, and a deliberate practice system built on peer-reviewed learning science.'
    },
    {
      slug: 'intro-design-thinking',
      school: 'mind',
      title: 'Design Thinking for Vision Builders',
      tagline: 'A practical toolkit for solving real problems.',
      status: 'coming_soon',
      price: 0,
      duration: 'Self-paced',
      level: 'Beginner friendly',
      description: 'Empathize, define, ideate, prototype, test — and turn insight into ideas that work.'
    },
    {
      slug: 'pattern-recognition-vision-builders',
      school: 'mind',
      title: 'Pattern Recognition for Vision Builders',
      tagline: 'See the patterns others miss.',
      status: 'coming_soon',
      price: 0,
      duration: 'Self-paced',
      level: 'Beginner friendly',
      description: 'Train your eye to spot recurring patterns in markets, behavior, and history — then act on them.'
    },
    {
      slug: 'architectural-thinking',
      school: 'mind',
      title: 'Architectural Thinking for Vision Builders',
      tagline: 'Build ideas that stand.',
      status: 'coming_soon',
      price: 0,
      duration: 'Self-paced',
      level: 'Beginner friendly',
      description: 'Blueprint thinking, design principles, and execution systems for building anything that matters.'
    },
    {
      slug: 'web-development',
      school: 'work',
      title: 'Web Development for Ghanaians',
      tagline: 'Build websites and start freelancing',
      hasLandingPage: true,
      status: 'active',
      price: 150,
      priceNote: 'Full access, one-time payment. Or start free with Module 1.',
      currency: 'GHS',
      duration: 'Self-paced',
      level: 'Beginner friendly',
      certification: 'Certificate of completion',
      description: 'Learn HTML, CSS, and JavaScript from scratch. Build real projects — a personal portfolio, a business website, and a landing page — and learn how to start freelancing as a web developer.',
      outcomes: [
        'Explain how the web works and write your first HTML page by hand',
        'Style pages with CSS — colors, fonts, and responsive layouts',
        'Add interactivity with JavaScript — buttons, forms, and dynamic content',
        'Build and launch two real projects: a business website and a portfolio',
        'Publish online for free and market yourself as a freelancer'
      ],
      modules: [
        { title: 'Module 1 — How the Web Works & Your First HTML Page', summary: 'How the internet works and writing your first HTML page.' },
        { title: 'Module 2 — Styling with CSS', summary: 'Add colors, fonts, and layout to your pages with CSS.' },
        { title: 'Module 3 — JavaScript: Making Pages Interactive', summary: 'Add interactivity with buttons, forms, and dynamic content.' },
        { title: 'Module 4 — Project 1: Business Website', summary: 'Build a complete landing page for a Ghanaian business.' },
        { title: 'Module 5 — Project 2: Portfolio & Publishing Online', summary: 'Build your portfolio and publish it for free on Netlify.' },
        { title: 'Module 6 — Freelancing as a Web Developer', summary: 'Find clients, set prices, and start earning as a freelance web developer.' }
      ],
      whoItsFor: 'Beginners with no coding experience who want to build real websites, launch their own projects, and start earning online.',
      sampleIncludes: 'Module 1 free · no card required · progress saved to your dashboard',
      faqs: [
        { q: 'Do I need any experience?', a: 'None. Module 1 starts from first principles and builds up.' },
        { q: 'How is the course delivered?', a: 'Self-paced modules in your personal dashboard, with checkpoints and a certificate when you finish.' },
        { q: 'What does "start free" mean?', a: 'Module 1 is free with no card. You pay only if you choose full access.' },
        { q: 'What will I be able to build?', a: 'A business website and your own portfolio, published online for free.' }
      ]
    },
    {
      slug: 'digital-marketing',
      school: 'work',
      title: 'Digital Marketing & Social Media',
      tagline: 'Grow brands and earn from anywhere',
      hasLandingPage: true,
      status: 'active',
      price: 150,
      priceNote: 'Full access, one-time payment. Or start free with Module 1.',
      currency: 'GHS',
      duration: 'Self-paced',
      level: 'Beginner friendly',
      certification: 'Certificate of completion',
      description: 'Learn to market businesses on social media, create content that sells, run ads, and build a career as a digital marketer. Practical, Ghana-focused, and results-driven.',
      outcomes: [
        'Understand the Ghanaian digital marketing landscape and where the opportunities are',
        'Build a content strategy and create posts that get attention',
        'Write captions, ads, and messages that convert',
        'Set up and optimize Facebook & Instagram ads for Ghanaian audiences',
        'Measure what works, grow followers organically, and turn it into a career'
      ],
      modules: [
        { title: 'Module 1 — The Ghana Digital Marketing Landscape', summary: 'Why digital marketing is booming in Ghana and where the opportunities are.' },
        { title: 'Module 2 — Social Media Strategy & Content Creation', summary: 'Build a content strategy and create posts that get attention.' },
        { title: 'Module 3 — Copywriting: Words That Sell', summary: 'Write captions, ads, and messages that convert.' },
        { title: 'Module 4 — Running Facebook & Instagram Ads', summary: 'Set up and optimize paid ad campaigns for Ghanaian audiences.' },
        { title: 'Module 5 — Analytics & Growing Your Audience', summary: 'Measure what works and grow followers organically.' },
        { title: 'Module 6 — Freelancing as a Digital Marketer', summary: 'Find clients, set prices, and build a marketing career.' }
      ],
      whoItsFor: 'Aspiring marketers, small business owners, and content creators who want to grow audiences and earn from digital marketing.',
      sampleIncludes: 'Module 1 free · no card required · progress saved to your dashboard',
      faqs: [
        { q: 'Do I need any experience?', a: 'None. Module 1 starts from first principles and builds up.' },
        { q: 'How is the course delivered?', a: 'Self-paced modules in your personal dashboard, with checkpoints and a certificate when you finish.' },
        { q: 'What does "start free" mean?', a: 'Module 1 is free with no card. You pay only if you choose full access.' },
        { q: 'Will these methods work in Ghana?', a: 'Yes — the whole course is built around the Ghanaian market, from content to ad targeting.' }
      ]
    },
    {
      slug: 'civic-intelligence',
      school: 'impact',
      title: 'Civic Intelligence Certificate',
      tagline: 'Build the tools and habits of engaged citizenship for Ghana\'s future',
      hasLandingPage: true,
      status: 'active',
      price: 0,
      priceNote: 'Free forever — start with Module 1 at no cost.',
      currency: 'GHS',
      duration: '12 weeks',
      level: 'Beginner friendly',
      certification: 'Certificate of completion',
      description: 'Learn how Ghana\'s democracy works, how to use civic technology to hold leaders accountable, and how to design and lead community action projects rooted in Ghana\'s national development frameworks — the 1992 Constitution, Vision 2057, the National Youth Policy, the Ghana AI Strategy, and the Ghana Infrastructure Plan.',
      outcomes: [
        'Explain how Ghana\'s 1992 Constitution, the three branches of government, and the 261 MMDAs shape civic life',
        'Use civic technology — manifesto meters, service delivery dashboards, and whistleblower tools — to hold power to account',
        'Apply the Data Protection Act and Ghana\'s AI Strategy to data sovereignty and public good',
        'Participate in governance through budgeting, Civic Education Clubs, and community organizing',
        'Read and influence national development plans, from the district level to Vision 2057'
      ],
      modules: [
        { title: 'Module 1 — The Citizen & the Constitution', summary: 'The 1992 Constitution, the three branches of government, the 261 MMDAs, and everyday citizen rights and responsibilities.' },
        { title: 'Module 2 — Civic Technology & Digital Accountability', summary: 'Manifesto meters, geotagged service delivery dashboards, and anonymous whistleblower tools that hold leaders to account.' },
        { title: 'Module 3 — Data Sovereignty & AI for Public Good', summary: 'The Data Protection Act, ethical AI aligned with the Ghana AI Strategy, and localized datasets in Ghanaian languages.' },
        { title: 'Module 4 — Participatory Governance & Community Organizing', summary: 'District assemblies, participatory budgeting, Civic Education Clubs, and CSO partnerships like CDD-Ghana and IMANI Africa.' },
        { title: 'Module 5 — National Development Planning Literacy', summary: 'Reading and influencing Vision 2057, the Ghana Infrastructure Plan, and district medium-term development plans.' },
        { title: 'Module 6 — Capstone: Civic Action Project', summary: 'Design and execute a real civic project — a manifesto meter pilot, infrastructure audit, club launch, or budgeting workshop.' }
      ],
      whoItsFor: 'Citizens, students, civil society leaders, and youth organizers who want to understand their rights and shape the future of their country.',
      sampleIncludes: 'Module 1 free · no card required · progress saved to your dashboard',
      faqs: [
        { q: 'Do I need any experience?', a: 'None. Module 1 starts from first principles and builds up.' },
        { q: 'How is the course delivered?', a: 'Self-paced modules in your personal dashboard, with checkpoints and a certificate when you finish.' },
        { q: 'What does "start free" mean?', a: 'Module 1 is free with no card, and the whole course is completely free — no payment required.' },
        { q: 'Is this connected to a government body?', a: 'No. It is an independent, citizen-focused program built on official public frameworks like the Constitution and national policies.' }
      ]
    },
    {
      slug: 'freelancing-ai',
      school: 'work',
      title: 'Freelancing with AI Tools',
      tagline: 'Use AI to land clients and deliver faster',
      hasLandingPage: true,
      status: 'active',
      price: 150,
      priceNote: 'Full access, one-time payment. Or start free with Module 1.',
      currency: 'GHS',
      duration: 'Self-paced',
      level: 'Beginner friendly',
      certification: 'Certificate of completion',
      description: 'Learn to use ChatGPT, Claude, Canva AI, and other free tools to create content, automate work, and start freelancing. No technical experience required.',
      outcomes: [
        'Set up a free AI toolkit that works for freelancing',
        'Use AI to write posts, design graphics, and create client-ready content',
        'Automate repetitive tasks and serve more clients with less effort',
        'Package your services, find clients, and start earning with AI'
      ],
      modules: [
        { title: 'Module 1 — Your AI Toolkit', summary: 'Set up ChatGPT, Canva AI, and other free tools for freelancing.' },
        { title: 'Module 2 — Content Creation with AI', summary: 'Use AI to write posts, design graphics, and create content for clients.' },
        { title: 'Module 3 — Automation & Productivity with AI', summary: 'Automate repetitive tasks and serve more clients with less effort.' },
        { title: 'Module 4 — Building Your Freelance Business', summary: 'Package your services, find clients, and start earning with AI.' }
      ],
      whoItsFor: 'Beginners who want to earn online — no technical background required, just a willingness to learn fast.',
      sampleIncludes: 'Module 1 free · no card required · progress saved to your dashboard',
      faqs: [
        { q: 'Do I need any experience?', a: 'None. Module 1 starts from first principles and builds up.' },
        { q: 'Do I need expensive tools?', a: 'No. The course is built around free tools you can start with today.' },
        { q: 'What does "start free" mean?', a: 'Module 1 is free with no card. You pay only if you choose full access.' },
        { q: 'Who can use AI freelancing?', a: 'Students, creatives, and career changers — near anytime, anywhere with an internet connection.' }
      ]
    },
    {
      slug: 'ai-fundamentals',
      school: 'mind',
      title: 'AI Fundamentals for Ghanaians',
      tagline: 'Understand AI, apply it to Ghanaian sectors, and build ethically',
      hasLandingPage: true,
      status: 'active',
      price: 0,
      priceNote: 'Free forever — start with Module 1 at no cost.',
      currency: 'GHS',
      duration: '6 weeks',
      level: 'Beginner friendly',
      certification: 'Certificate of completion',
      description: 'Ghana\'s National AI Strategy envisions an AI-powered society by 2035. This program introduces what AI is, how it works, and how it applies to Ghana\'s key sectors — agriculture, health, education, and governance — through real Ghanaian use cases, while covering the ethics of the Responsible AI Authority and the UNESCO AI Ethics recommendations.',
      outcomes: [
        'Explain what AI is and how machine learning, natural language processing, and computer vision work',
        'Spot real AI applications across Ghanaian agriculture, health, education, and governance',
        'Work with Ghanaian language AI and localized datasets',
        'Apply ethical frameworks — the Responsible AI Authority, the Data Protection Act, and UNESCO recommendations',
        'Design an AI opportunity map for a problem in your community or sector'
      ],
      modules: [
        { title: 'Module 1 — What Is AI and Why Does It Matter for Ghana?', summary: 'Definitions of AI, a brief history, and the Ghana AI Strategy vision of an AI-powered society by 2035.' },
        { title: 'Module 2 — AI for Ghanaian Agriculture & Environment', summary: 'Crop disease detection, weather prediction, soil monitoring, and supply chain optimization.' },
        { title: 'Module 3 — AI for Health, Education & Governance', summary: 'AI diagnostics for healthcare, personalized learning tools, and predictive analytics for public services.' },
        { title: 'Module 4 — Ghanaian Language AI & Localized Datasets', summary: 'Natural language processing for Twi, Ewe, Dagbani, and tools like Khaya and Mozilla Common Voice.' },
        { title: 'Module 5 — AI Ethics, the Responsible AI Authority & the Data Protection Act', summary: 'Algorithmic bias, data privacy, UNESCO AI Ethics recommendations, and building AI that serves all Ghanaians.' },
        { title: 'Module 6 — Capstone: AI Opportunity Map', summary: 'Identify a problem in your community and design an AI-powered solution concept.' }
      ],
      whoItsFor: 'Students, professionals, and curious citizens who want to understand AI well enough to apply it — ethically — in Ghana.',
      sampleIncludes: 'Module 1 free · no card required · progress saved to your dashboard',
      faqs: [
        { q: 'Do I need any experience?', a: 'None. Module 1 starts from first principles and builds up.' },
        { q: 'Do I need to be technical?', a: 'No. The focus is on understanding and applying AI, not heavy coding.' },
        { q: 'What does "start free" mean?', a: 'Module 1 is free with no card, and the whole course is completely free — no payment required.' },
        { q: 'Will I learn to build AI?', a: 'You will learn to design AI solutions and map opportunities — the foundation for building with AI.' }
      ]
    },
    {
      slug: 'essential-values',
      school: 'impact',
      title: 'Essential Values for National Development',
      tagline: 'Character formation for engaged citizenship and nation building',
      hasLandingPage: true,
      status: 'active',
      price: 0,
      priceNote: 'Free forever — start with Module 1 at no cost.',
      currency: 'GHS',
      duration: '6 weeks',
      level: 'Beginner friendly',
      certification: 'Certificate of completion',
      description: 'Based on the Essential Values for Ghanaian Youth Handbook, this program covers the core values that sustain democracy and development: responsible citizenship, honesty, integrity, diversity, equity, discipline, and self-directed learning — each grounded in Adinkra symbols and cultural wisdom.',
      outcomes: [
        'Live out responsible citizenship grounded in rights, duties, and the common good',
        'Detect and resist misinformation with honesty and verified information',
        'Practise integrity in public and private life',
        'Turn Ghana\'s diversity into national strength through equity',
        'Build discipline and self-directed learning — and teach it to others'
      ],
      modules: [
        { title: 'Module 1 — Responsible Citizenship', summary: 'What it means to be a citizen of Ghana — rights, responsibilities, and the common good.' },
        { title: 'Module 2 — Honesty & Combating Misinformation', summary: 'Truthfulness in public and private life. How misinformation spreads and how to verify information.' },
        { title: 'Module 3 — Integrity in Public & Private Life', summary: 'Consistency between word and action, with case studies from Ghanaian public life.' },
        { title: 'Module 4 — Diversity & Equity as National Strength', summary: 'Ghana\'s ethnic, linguistic, and religious diversity as a source of strength. Understanding equity vs. equality.' },
        { title: 'Module 5 — Discipline & Self-Directed Learning', summary: 'Discipline as the foundation of excellence. Self-directed learning for lifelong growth.' },
        { title: 'Module 6 — Capstone: Values in Action Project', summary: 'Design a community workshop, club session, or public awareness campaign based on the essential values.' }
      ],
      whoItsFor: 'Students, educators, and community leaders who want to build the personal values that sustain democracy and national development.',
      sampleIncludes: 'Module 1 free · no card required · progress saved to your dashboard',
      faqs: [
        { q: 'Do I need any experience?', a: 'None. Module 1 starts from first principles and builds up.' },
        { q: 'Is this course religious?', a: 'No. It draws on Ghanaian cultural wisdom — including Adinkra symbols — alongside civic and democratic principles.' },
        { q: 'What does "start free" mean?', a: 'Module 1 is free with no card, and the whole course is completely free — no payment required.' },
        { q: 'How is the course delivered?', a: 'Self-paced modules in your personal dashboard, with checkpoints and a certificate when you finish.' }
      ]
    },
    {
      slug: 'digital-entrepreneurship',
      school: 'work',
      title: 'Digital Entrepreneurship & the Creative Economy',
      tagline: 'Build digital products and creative businesses for Ghanaian and global markets',
      hasLandingPage: true,
      status: 'active',
      price: 0,
      priceNote: 'Free forever — start with Module 1 at no cost.',
      currency: 'GHS',
      duration: '8 weeks',
      level: 'Beginner friendly',
      certification: 'Certificate of completion',
      description: 'Ghana\'s digital economy is growing rapidly. This program teaches practical skills for building digital products and creative businesses: identifying market opportunities, building a minimum viable product, leveraging mobile money and USSD, digital marketing for Ghanaian audiences, and navigating the creative economy — music, content creation, and cultural products.',
      outcomes: [
        'Map opportunities in Ghana\'s digital economy and growing creative industries',
        'Validate demand with customer interviews and market research before you build',
        'Ship a minimum viable product with no-code tools, mobile money APIs, USSD, and WhatsApp',
        'Reach urban and rural audiences with affordable digital marketing',
        'Complete a business model canvas and 60-second pitch for your venture'
      ],
      modules: [
        { title: 'Module 1 — Ghana\'s Digital Economy Landscape', summary: 'The state of Ghana\'s digital economy: mobile money, tech hubs, creative industries, and growing startup ecosystem.' },
        { title: 'Module 2 — Identifying Problems & Validating Ideas', summary: 'How to find problems worth solving, conduct customer interviews, and validate demand before building.' },
        { title: 'Module 3 — Building a Minimum Viable Product', summary: 'No-code and low-code tools, mobile money APIs, USSD, and WhatsApp for distribution.' },
        { title: 'Module 4 — Digital Marketing for Ghanaian Audiences', summary: 'Social media marketing, influencer partnerships, SMS and WhatsApp campaigns, and community-driven growth.' },
        { title: 'Module 5 — The Creative Economy: Music, Content & Cultural Products', summary: 'Building a career in digital music distribution, content creation, monetization, and intellectual property.' },
        { title: 'Module 6 — Capstone: Business Model Canvas & Pitch', summary: 'Complete a business model canvas and a 60-second pitch for your digital or creative venture.' }
      ],
      whoItsFor: 'Aspiring entrepreneurs, creatives, and side-hustlers who want to build digital products and creative businesses for Ghanaian and global markets.',
      sampleIncludes: 'Module 1 free · no card required · progress saved to your dashboard',
      faqs: [
        { q: 'Do I need any experience?', a: 'None. Module 1 starts from first principles and builds up.' },
        { q: 'Do I need to invest capital to start?', a: 'No. The course is built around low-cost and no-code tools you can start with today.' },
        { q: 'What does "start free" mean?', a: 'Module 1 is free with no card, and the whole course is completely free — no payment required.' },
        { q: 'Can I use this outside Ghana?', a: 'Yes — the frameworks are universal, with Ghana-specific examples that translate across markets.' }
      ]
    },
    {
      slug: 'youth-leadership',
      school: 'impact',
      title: 'Youth Leadership & Community Organizing',
      tagline: 'Lead community change through civic clubs, projects, and advocacy',
      hasLandingPage: true,
      status: 'active',
      price: 0,
      priceNote: 'Free forever — start with Module 1 at no cost.',
      currency: 'GHS',
      duration: '6 weeks',
      level: 'Beginner friendly',
      certification: 'Certificate of completion',
      description: 'Ghana\'s National Youth Policy envisions an empowered youth contributing positively to national development. This program teaches practical leadership skills: how to start a Civic Education Club, organize community projects, advocate at the district assembly level, build coalitions with CSOs, and communicate effectively across media.',
      outcomes: [
        'Understand the National Youth Policy and your role in Ghana\'s development',
        'Start and sustain a Civic Education Club at your school, church, or community center',
        'Design and execute community projects with clear plans and impact measurement',
        'Engage district assemblies and advocate for policy change',
        'Build coalitions with CSOs and communicate across media'
      ],
      modules: [
        { title: 'Module 1 — The National Youth Policy & Your Role', summary: 'Ghana\'s National Youth Policy vision and your role in it as a young leader.' },
        { title: 'Module 2 — Starting & Running a Civic Education Club', summary: 'How to start a club, recruit members, plan activities, and sustain engagement.' },
        { title: 'Module 3 — Community Project Design & Execution', summary: 'Needs assessment, stakeholder mapping, resource planning, timelines, and impact measurement.' },
        { title: 'Module 4 — Engaging District Assemblies & Advocating for Change', summary: 'How MMDAs work, how to submit proposals, join budget hearings, and advocate for change.' },
        { title: 'Module 5 — Coalition Building & CSO Partnerships', summary: 'Partnering with CSOs like CDD-Ghana, IMANI Africa, and the Ghana Integrity Initiative.' },
        { title: 'Module 6 — Capstone: Community Organizing Project', summary: 'Launch a real organizing initiative with a project charter, budget, and success metrics.' }
      ],
      whoItsFor: 'Young people — students, church and community volunteers, and first-time organizers — who want to lead change where they are.',
      sampleIncludes: 'Module 1 free · no card required · progress saved to your dashboard',
      faqs: [
        { q: 'Do I need any experience?', a: 'None. Module 1 starts from first principles and builds up.' },
        { q: 'Do I need a club or position first?', a: 'No. The course teaches you how to start one from scratch — even in Module 1.' },
        { q: 'What does "start free" mean?', a: 'Module 1 is free with no card, and the whole course is completely free — no payment required.' },
        { q: 'Is this only for students?', a: 'No. It is for any young person ready to organize — in schools, churches, and communities.' }
      ]
    },
    {
      slug: 'sketching-vision-builders',
      school: 'expression',
      title: 'Sketching & Drawing for Vision Builders',
      tagline: 'Drawing is thinking made visible.',
      hasLandingPage: true,
      status: 'active',
      price: 0,
      priceNote: 'Free forever — start with Module 1 at no cost.',
      currency: 'GHS',
      duration: 'Self-paced',
      level: 'Beginner friendly',
      certification: 'Certificate of completion',
      description: 'Every great building, business, and movement begins with a sketch. This practical program teaches you to use drawing as a thinking tool — observation, perspective, composition, and visual storytelling — not to become a fine artist, but to become a clearer thinker and a more effective visionary. From a seven-day warm-up to a hand-drawn capstone Vision Board, every exercise is built for daily practice and real projects.',
      outcomes: [
        'Keep a daily sketchbook practice that makes your thinking concrete',
        'See like an artist — contours, negative space, gesture, and proportion',
        'Draw what you see with line, shape, perspective, and shading',
        'Compose drawings and storyboards that explain ideas in seconds',
        'Draw from imagination using your internal visual library',
        'Create a hand-drawn Vision Board that communicates a real project or dream'
      ],
      modules: [
        { title: 'Module 1 — The Visionary\'s Sketchbook', summary: 'Set up a daily 10-minute sketchbook practice and complete a seven-day observation warm-up.' },
        { title: 'Module 2 — Seeing Like an Artist', summary: 'Five seeing exercises — contour, negative space, gesture, and more — that retrain your eye.' },
        { title: 'Module 3 — Line, Shape & Form', summary: 'The visual vocabulary of drawing: line quality, basic shapes, perspective, and shading.' },
        { title: 'Module 4 — Composition & Visual Storytelling', summary: 'Arrange what you draw to communicate — focal point, thumbnails, and storyboarding.' },
        { title: 'Module 5 — Drawing from Imagination', summary: 'Build a visual library and draw what does not yet exist — the essential visionary skill.' },
        { title: 'Module 6 — Capstone: Vision Board Project', summary: 'Design and present a hand-drawn Vision Board for a real project, idea, or dream.' }
      ],
      whoItsFor: 'Vision builders — founders, creators, students, and leaders — who want to think visually, communicate big ideas, and bring dreams from imagination onto paper.',
      sampleIncludes: 'Module 1 free · no card required · progress saved to your dashboard',
      faqs: [
        { q: 'Do I need to be able to draw?', a: 'No. The program starts from the very beginning — Module 1 is a seven-day warm-up designed for complete beginners.' },
        { q: 'Is this about becoming an artist?', a: 'No. Drawing here is a thinking tool — clarity, planning, and communication — not gallery art.' },
        { q: 'What materials do I need?', a: 'Just a sketchbook and a pen. Module 1 tells you exactly what to get and how to start today.' },
        { q: 'What does "start free" mean?', a: 'Module 1 is free with no card, and the whole course is completely free — no payment required.' }
      ]
    },
    {
      slug: 'systems-thinking-genesis',
      school: 'wisdom',
      title: 'The Spirit of God in Genesis: Creativity, Wisdom & Love',
      tagline: 'Journey through all 50 chapters of Genesis through the Spirit\'s creativity, wisdom, and love.',
      hasLandingPage: true,
      status: 'active',
      price: 250,
      priceNote: 'Full access, one-time payment. Or start free with Module 1.',
      currency: 'GHS',
      duration: 'Self-paced',
      level: 'Beginner friendly',
      certification: 'Certificate of completion',
      description: 'Genesis is not simply a book of beginnings — it is the revelation of God\'s nature as Creator, Wisdom, and Love. This six-module program reads Genesis 1–50 through three lenses drawn from the text itself: Divine Creativity (the Spirit hovering over creation), Divine Wisdom (God\'s ordering of all things), and Divine Love (covenant faithfulness). Each module pairs Scripture with practical thinking frameworks — systems thinking, design thinking, creative thinking, and pattern recognition — so the book shapes how you see, design, and build.',
      outcomes: [
        'Read all 50 chapters of Genesis through the Spirit\'s creativity, wisdom, and love',
        'See the six days of creation as an ordered process — and a template for your own creative work',
        'Apply systems thinking to the flood, Babel, the covenant, and Joseph\'s governance',
        'Map the Abrahamic covenant as a designed system with feedback loops',
        'Trace God\'s redemptive patterns through Isaac, Jacob, and Joseph',
        'Complete each module with a Scripture-first application exercise for your own life'
      ],
      modules: [
        { title: 'Module 1 — The Spirit Hovering: Divine Creativity in Creation', summary: 'Genesis 1–2. The Spirit\'s creative process — separation, formation, filling — as the template for all creativity.' },
        { title: 'Module 2 — The God Who Restores: Wisdom in the Fall & Flood', summary: 'Genesis 3–9. Judgment and redemption as a wise, systemic reset that preserves a remnant.' },
        { title: 'Module 3 — Noah to Babel: Divine Love Preserving and Scattering', summary: 'Genesis 6–11. Grace, covenant, and the table of nations — love that preserves and redirects.' },
        { title: 'Module 4 — Abraham: The Covenant as a Divine Design System', summary: 'Genesis 12–22. A masterclass in design thinking — purpose, boundaries, testing, and feedback loops.' },
        { title: 'Module 5 — Isaac & Jacob: Patterns of Grace, Struggle & Transformation', summary: 'Genesis 25–35. Family systems reveal God\'s redemptive patterns of struggle and renewal.' },
        { title: 'Module 6 — Joseph: Divine Sovereignty as the Ultimate System', summary: 'Genesis 37–50. Stocks, flows, and sovereignty — how God orchestrates all systems for good.' }
      ],
      whoItsFor: 'Students of Scripture, vision builders, and curious readers who want to read Genesis with fresh eyes — pairing the biblical text with systems, design, and pattern-recognition lenses.',
      sampleIncludes: 'Module 1 free · no card required · progress saved to your dashboard',
      faqs: [
        { q: 'Do I need theological training?', a: 'No. Every module starts from the biblical text and builds up — Scripture first, thinking frameworks second.' },
        { q: 'Is this a Bible study or a thinking course?', a: 'Both. The lens always comes from the passage itself — divine creativity, wisdom, or love — so the two reinforce each other.' },
        { q: 'What does "start free" mean?', a: 'Module 1 is free with no card. You pay only if you choose full access.' },
        { q: 'How is the course delivered?', a: 'Self-paced modules in your personal dashboard, with checkpoints and a certificate when you finish.' }
      ]
    },
    {
      slug: 'revelation-study',
      school: 'wisdom',
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
      school: 'wisdom',
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
      school: 'wisdom',
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
      school: 'mind',
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
      school: 'mind',
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
      school: 'mind',
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
      school: 'expression',
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