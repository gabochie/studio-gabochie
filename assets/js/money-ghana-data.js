/* Studio Gabochie — Ghana online-income assessment data.
   All visible content on /money-ghana/ is rendered from this object. */
window.MONEY_GHANA_DATA = {
  intro: {
    lead: "To make money legally, ethically and reliably in Ghana, focus on selling verified skills, digital products, or local e-commerce — not quick-cash schemes or platforms that cannot pay Ghanaian users.",
    note: "Global processors such as PayPal have strict receiving limits in Ghana. Prioritise paths that pay through Mobile Money (MoMo), local bank transfer, Payoneer or Wise."
  },
  categories: [
    { id: "freelance", name: "Freelancing", icon: "ti-device-desktop", blurb: "Trade your time and expertise directly for local or international clients." },
    { id: "commerce", name: "E-commerce", icon: "ti-shopping-cart", blurb: "Sell physical goods online using Ghanaian delivery networks and MoMo." },
    { id: "content", name: "Content & Media", icon: "ti-video", blurb: "Build an audience around a topic and monetise their attention." },
    { id: "education", name: "Education & Products", icon: "ti-book", blurb: "Package your knowledge once and sell it repeatedly with near-zero overhead." },
    { id: "affiliate", name: "Affiliate", icon: "ti-link", blurb: "Earn commissions by recommending legitimate products and services." },
    { id: "remote", name: "Remote Work", icon: "ti-world", blurb: "Work remotely or complete small digital tasks for established companies." }
  ],
  questions: [
    {
      id: "profile",
      label: "What best describes you?",
      options: [
        { value: "beginner", label: "Complete beginner", hint: "Starting from zero" },
        { value: "creative", label: "Creative / design-minded", hint: "I like making things" },
        { value: "tech", label: "Tech-savvy", hint: "I learn tools fast" },
        { value: "writing", label: "Good with words", hint: "Writing, editing, explaining" },
        { value: "teaching", label: "Good at teaching", hint: "I can tutor or coach" }
      ]
    },
    {
      id: "setup",
      label: "What device do you have?",
      options: [
        { value: "phone", label: "Smartphone only", hint: "Mobile-first paths" },
        { value: "laptop", label: "Laptop + reliable internet", hint: "Full toolkit" }
      ]
    },
    {
      id: "capital",
      label: "Starting capital?",
      options: [
        { value: "zero", label: "Strictly GHS 0", hint: "No money to invest" },
        { value: "small", label: "A small budget", hint: "I can invest a little" }
      ]
    }
  ],
  labels: {
    profiles: { beginner: "Complete beginner", creative: "Creative", tech: "Tech-savvy", writing: "Writing", teaching: "Teaching" },
    setup: { phone: "Smartphone", laptop: "Laptop + internet" },
    capital: { zero: "GHS 0", small: "Small budget" }
  },
  methods: [
    { id: 1, category: "freelance", title: "Digital marketing & social media management", description: "Run paid ads, manage accounts and create content calendars for Ghanaian businesses on Instagram, TikTok and Facebook.", tags: ["Instagram", "TikTok", "Facebook", "Paid ads"], payout: "Local clients - MoMo / Bank", profiles: ["creative", "writing", "beginner"], setup: ["phone", "laptop"], capital: ["zero"] },
    { id: 2, category: "freelance", title: "Graphic design & video editing", description: "Create flyers, logos and short-form video reels for brands, event planners and YouTubers using Canva, CapCut or Adobe Creative Suite.", tags: ["Canva", "CapCut", "Adobe"], payout: "Local clients - MoMo / Bank", profiles: ["creative", "tech", "beginner"], setup: ["phone", "laptop"], capital: ["zero"] },
    { id: 3, category: "freelance", title: "Writing, copywriting & editing", description: "Write website copy, SEO blog posts, grant proposals and academic edits on platforms like Upwork and Fiverr.", tags: ["Upwork", "Fiverr", "SEO"], payout: "Global clients - Payoneer / Wise", profiles: ["writing", "beginner"], setup: ["phone", "laptop"], capital: ["zero"] },
    { id: 4, category: "freelance", title: "Virtual assistance (VA)", description: "Handle email management, customer support, data entry and scheduling for busy entrepreneurs globally.", tags: ["Email", "Support", "Data entry"], payout: "Global clients - Payoneer / Wise", profiles: ["beginner", "writing", "tech"], setup: ["laptop"], capital: ["zero"] },
    { id: 5, category: "freelance", title: "Web & app development", description: "Build websites, e-commerce stores and mobile apps for businesses locally and abroad.", tags: ["Websites", "E-commerce", "Apps"], payout: "Local & global - Bank / Payoneer", profiles: ["tech"], setup: ["laptop"], capital: ["zero"] },
    { id: 6, category: "freelance", title: "Bookkeeping & data analysis", description: "Offer remote accounting, Excel modelling and data cleanup services to small businesses.", tags: ["Excel", "Accounting", "Data cleanup"], payout: "Local businesses - MoMo / Bank", profiles: ["tech", "writing"], setup: ["laptop"], capital: ["zero"] },
    { id: 7, category: "freelance", title: "Translation & localisation", description: "Translate documents or transcribe audio in English and local Ghanaian languages — Twi, Ga, Ewe or Hausa — for research firms and media agencies.", tags: ["Twi", "Ga", "Ewe", "Hausa"], payout: "International firms - Payoneer / Wise", profiles: ["writing", "teaching"], setup: ["laptop"], capital: ["zero"] },
    { id: 8, category: "commerce", title: "Local dropshipping & social commerce", description: "Partner with wholesalers in Makola, Kantamanto or Kejetia. Photograph their items, post on WhatsApp Status, Instagram or Jiji with a markup, and deliver with dispatch riders after MoMo payment.", tags: ["WhatsApp", "Instagram", "Jiji"], payout: "Customers pay via MoMo", profiles: ["creative", "beginner"], setup: ["phone", "laptop"], capital: ["zero", "small"] },
    { id: 9, category: "commerce", title: "Mini-importation", description: "Source high-demand items such as phone accessories, wigs or household gadgets from 1688 or Alibaba using freight forwarders in Accra or Kumasi, then resell online.", tags: ["1688", "Alibaba", "Freight forwarders"], payout: "Resale - MoMo / Bank", profiles: ["tech", "beginner"], setup: ["phone", "laptop"], capital: ["small"] },
    { id: 10, category: "commerce", title: "Print-on-demand (POD)", description: "Design custom t-shirts, mugs and tote bags and sell globally through platforms that handle printing and shipping, such as Redbubble or Teespring.", tags: ["Redbubble", "Teespring", "Design"], payout: "Platform payout - Bank / Payoneer", profiles: ["creative"], setup: ["laptop"], capital: ["zero"] },
    { id: 11, category: "commerce", title: "Handmade & local goods", description: "Sell authentic Ghanaian crafts, shea butter, kente or art to international buyers on Etsy or through social media.", tags: ["Etsy", "Kente", "Shea butter"], payout: "Etsy / MoMo / Bank", profiles: ["creative", "beginner"], setup: ["phone", "laptop"], capital: ["zero", "small"] },
    { id: 12, category: "content", title: "YouTube monetisation", description: "Create educational, tech, lifestyle or entertainment videos. Once you meet YouTube's eligibility criteria, earn ad revenue paid to your Ghanaian bank account through Google AdSense.", tags: ["YouTube", "AdSense", "Video"], payout: "AdSense to Ghanaian bank", profiles: ["creative", "tech", "teaching", "beginner"], setup: ["phone", "laptop"], capital: ["zero"] },
    { id: 13, category: "content", title: "Blogging & niche websites", description: "Build a site around topics such as Ghanaian recipes, tech reviews or career advice, and monetise with AdSense and sponsored articles.", tags: ["AdSense", "SEO", "Sponsored posts"], payout: "AdSense + sponsors - Bank", profiles: ["writing", "teaching", "tech"], setup: ["laptop"], capital: ["zero"] },
    { id: 14, category: "content", title: "Brand sponsorships & UGC", description: "Partner with Ghanaian telecoms, banks and retail brands to promote products on TikTok, Instagram or X — or create promotional videos for brands to use on their own pages.", tags: ["TikTok", "Instagram", "UGC"], payout: "Local brands - MoMo / Bank", profiles: ["creative", "writing", "beginner"], setup: ["phone", "laptop"], capital: ["zero"] },
    { id: 15, category: "content", title: "Podcasting", description: "Start an audio or video podcast on Spotify and YouTube and monetise through local brand sponsorships and listener support.", tags: ["Spotify", "YouTube", "Sponsors"], payout: "Sponsorships + listener support", profiles: ["creative", "teaching", "writing"], setup: ["phone", "laptop"], capital: ["zero"] },
    { id: 16, category: "education", title: "Online academic & skill tutoring", description: "Teach Core Maths, Science, English or coding to local students via Zoom or WhatsApp, or teach international students on Preply and Cambly.", tags: ["Zoom", "WhatsApp", "Preply", "Cambly"], payout: "Local MoMo / global Payoneer", profiles: ["teaching", "tech", "writing"], setup: ["laptop"], capital: ["zero"] },
    { id: 17, category: "education", title: "Selling e-books & guides", description: "Write practical guides — exam notes, relocation guides or business templates — and sell them through Paystack Storefront or Selar.", tags: ["Paystack Storefront", "Selar", "Guides"], payout: "Paystack / Selar - Bank / MoMo", profiles: ["writing", "teaching"], setup: ["phone", "laptop"], capital: ["zero"] },
    { id: 18, category: "education", title: "Online courses & workshops", description: "Record video courses or host paid live masterclasses on WhatsApp or Telegram teaching a high-income skill.", tags: ["WhatsApp", "Telegram", "Masterclasses"], payout: "MoMo / Bank", profiles: ["teaching", "tech", "creative"], setup: ["phone", "laptop"], capital: ["zero"] },
    { id: 19, category: "education", title: "Digital templates & assets", description: "Sell Notion templates, Canva templates, CV designs or photography presets to creators and professionals.", tags: ["Notion", "Canva", "CV designs"], payout: "Paystack / Selar - Bank / MoMo", profiles: ["creative", "tech"], setup: ["laptop"], capital: ["zero"] },
    { id: 20, category: "affiliate", title: "Local brand affiliate programs", description: "Join referral programmes for electronics brands, e-commerce sites such as Jumia, or local fintech apps and earn a commission on purchases through your link.", tags: ["Jumia", "Fintech", "Referrals"], payout: "Commissions - MoMo / Bank", profiles: ["beginner", "creative", "writing"], setup: ["phone", "laptop"], capital: ["zero"] },
    { id: 21, category: "affiliate", title: "Global software & product affiliates", description: "Promote web hosting, AI tools or Amazon products to an international audience through a blog or YouTube channel.", tags: ["Hosting", "AI tools", "Amazon"], payout: "Global networks - Payoneer / Wise", profiles: ["writing", "tech", "creative"], setup: ["laptop"], capital: ["zero"] },
    { id: 22, category: "remote", title: "Full-time remote roles", description: "Apply for remote customer support, operations, tech or marketing roles at international startups through job boards such as We Work Remotely and Remote OK.", tags: ["We Work Remotely", "Remote OK"], payout: "Employer payroll - Bank / Payoneer", profiles: ["tech", "writing", "beginner"], setup: ["laptop"], capital: ["zero"] },
    { id: 23, category: "remote", title: "AI training & data annotation", description: "Work as an independent contractor evaluating AI responses, labelling images or transcribing audio on legitimate platforms like Outlier, DataAnnotation or Appen.", tags: ["Outlier", "DataAnnotation", "Appen"], payout: "Platform payout - Payoneer / Wise", profiles: ["tech", "writing", "beginner"], setup: ["laptop"], capital: ["zero"] },
    { id: 24, category: "remote", title: "User testing", description: "Get paid to test websites and apps and record your spoken feedback on platforms such as UserTesting.", tags: ["UserTesting", "Feedback"], payout: "Platform payout - Payoneer / Wise", profiles: ["beginner", "tech", "writing"], setup: ["laptop"], capital: ["zero"] }
  ],
  guardrails: [
    { icon: "ti-shield-x", title: "Avoid pay-to-work schemes", body: "Legitimate online jobs and freelance platforms never ask for an upfront registration or activation fee to unlock earnings." },
    { icon: "ti-credit-card", title: "Verify payout methods first", body: "Before investing time in an international platform, confirm it pays via Payoneer, Wise, bank wire, or local processors such as Paystack and Flutterwave. Standard Ghanaian PayPal accounts cannot receive funds." },
    { icon: "ti-clock", title: "Skip unreliable survey sites", body: "Most global survey apps pay pennies or disqualify Ghanaian IP addresses. Your time is better spent building a marketable digital skill." }
  ],
  nextSteps: [
    "Your current skills or background — student, good at writing, tech-savvy, or complete beginner?",
    "Your available resources — smartphone only, or laptop with reliable internet?",
    "Starting capital — strictly GHS 0, or a small budget to invest?"
  ]
};
