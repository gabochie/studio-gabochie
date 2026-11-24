// Shared source of truth for the 30-day assessment-led content calendar.
// Imported by functions/api/db/setup.js (D1 seed) and the admin content calendar.
// Mirrors docs/30-day-assessment-calendar.md.

const A = 'https://studio.gabochie.com/money-ghana/';
const C = 'https://studio.gabochie.com/consultation/';

function assessment(source, medium, campaign) {
  return A + '?utm_source=' + source + '&utm_medium=' + medium + '&utm_campaign=' + campaign;
}

function consultation(source, medium, campaign) {
  return C + '?from=money-ghana&utm_source=' + source + '&utm_medium=' + medium + '&utm_campaign=' + campaign;
}

export const CONTENT_CALENDAR_PLAN = [
  {
    day: 1, week: 1, arc: 'Is this even possible in Ghana?', pillar: 'Education',
    platform: 'instagram', format: 'Reel / TikTok',
    hook: '24 legal ways to make money online in Ghana. Here are 5 you can start with a phone.',
    paths: '1, 2, 3, 8, 12', cta: 'Soft — link in bio',
    utm_campaign: 'assessment-d01', hard_cta: false,
    cta_url: assessment('instagram', 'social', 'assessment-d01')
  },
  {
    day: 2, week: 1, arc: 'Is this even possible in Ghana?', pillar: 'Education',
    platform: 'instagram', format: 'Carousel',
    hook: 'Phone-only + GHS 0: six paths that actually fit.',
    paths: '1, 2, 3, 8, 12, 14', cta: 'Soft — comment PHONE + story',
    utm_campaign: 'assessment-d02', hard_cta: false,
    cta_url: assessment('instagram', 'social', 'assessment-d02')
  },
  {
    day: 3, week: 1, arc: 'Is this even possible in Ghana?', pillar: 'Trust',
    platform: 'instagram', format: 'Reel',
    hook: "3 signs an 'online job' is a scam in Ghana.",
    paths: 'Guardrails 1–3', cta: 'Soft — see the safe list',
    utm_campaign: 'assessment-d03', hard_cta: false,
    cta_url: assessment('instagram', 'social', 'assessment-d03')
  },
  {
    day: 4, week: 1, arc: 'Is this even possible in Ghana?', pillar: 'Education',
    platform: 'instagram', format: 'Carousel',
    hook: 'MoMo, Payoneer, Wise — which payout should you chase first?',
    paths: 'Intro note; 3, 5, 7, 20', cta: 'Soft — match to a payout path',
    utm_campaign: 'assessment-d04', hard_cta: false,
    cta_url: assessment('instagram', 'social', 'assessment-d04')
  },
  {
    day: 5, week: 1, arc: 'Is this even possible in Ghana?', pillar: 'Trust',
    platform: 'instagram', format: 'Founder post',
    hook: 'Why I built a 3-question test instead of another ebook.',
    paths: '', cta: 'Soft — try it',
    utm_campaign: 'assessment-d05', hard_cta: false,
    cta_url: assessment('instagram', 'social', 'assessment-d05')
  },
  {
    day: 6, week: 1, arc: 'Is this even possible in Ghana?', pillar: 'Conversion',
    platform: 'instagram', format: 'Story sequence + bio',
    hook: '2 minutes, 3 questions, your #1 path. Poll: phone or laptop?',
    paths: '', cta: 'Hard CTA — story link',
    utm_campaign: 'assessment-d06', hard_cta: true,
    cta_url: assessment('instagram', 'story', 'assessment-d06')
  },
  {
    day: 7, week: 1, arc: 'Is this even possible in Ghana?', pillar: 'Education',
    platform: 'newsletter', format: 'Recap post + newsletter',
    hook: 'The question you asked most this week: where do I start?',
    paths: '1, 2, 3, 8', cta: 'Soft — weekly recap',
    utm_campaign: 'assessment-w1', hard_cta: false,
    cta_url: assessment('newsletter', 'email', 'assessment-w1')
  },
  {
    day: 8, week: 2, arc: 'Phone + GHS 0', pillar: 'Education',
    platform: 'instagram', format: 'Reel',
    hook: 'Design flyers on your phone with Canva and get paid via MoMo.',
    paths: '2', cta: 'Soft — comment DESIGN',
    utm_campaign: 'assessment-d08', hard_cta: false,
    cta_url: assessment('instagram', 'social', 'assessment-d08')
  },
  {
    day: 9, week: 2, arc: 'Phone + GHS 0', pillar: 'Education',
    platform: 'instagram', format: 'Carousel',
    hook: 'Social media management from a phone: the first 3 steps.',
    paths: '1', cta: 'Soft — take the test',
    utm_campaign: 'assessment-d09', hard_cta: false,
    cta_url: assessment('instagram', 'social', 'assessment-d09')
  },
  {
    day: 10, week: 2, arc: 'Phone + GHS 0', pillar: 'Education',
    platform: 'instagram', format: 'Reel',
    hook: 'Copywriting with no capital: one paragraph that sells.',
    paths: '3', cta: 'Soft — take the test',
    utm_campaign: 'assessment-d10', hard_cta: false,
    cta_url: assessment('instagram', 'social', 'assessment-d10')
  },
  {
    day: 11, week: 2, arc: 'Phone + GHS 0', pillar: 'Education',
    platform: 'whatsapp', format: 'Broadcast',
    hook: 'Sell Makola/Kantamanto stock on WhatsApp Status — no rent, no shop.',
    paths: '8', cta: 'Soft — direct link',
    utm_campaign: 'assessment-d11', hard_cta: false,
    cta_url: assessment('whatsapp', 'broadcast', 'assessment-d11')
  },
  {
    day: 12, week: 2, arc: 'Phone + GHS 0', pillar: 'Education',
    platform: 'instagram', format: 'Carousel',
    hook: 'UGC and brand sponsorships: what Ghanaian brands actually pay for.',
    paths: '14', cta: 'Soft — take the test',
    utm_campaign: 'assessment-d12', hard_cta: false,
    cta_url: assessment('instagram', 'social', 'assessment-d12')
  },
  {
    day: 13, week: 2, arc: 'Phone + GHS 0', pillar: 'Trust',
    platform: 'instagram', format: 'Reel',
    hook: 'Why we left survey sites off the list.',
    paths: 'Guardrail 3', cta: 'Soft — see the 24',
    utm_campaign: 'assessment-d13', hard_cta: false,
    cta_url: assessment('instagram', 'social', 'assessment-d13')
  },
  {
    day: 14, week: 2, arc: 'Phone + GHS 0', pillar: 'Conversion',
    platform: 'instagram', format: 'Challenge post',
    hook: 'Phone-only challenge: take the test, screenshot your match, tag us.',
    paths: '', cta: 'Hard CTA — weekly challenge',
    utm_campaign: 'assessment-w2', hard_cta: true,
    cta_url: assessment('instagram', 'social', 'assessment-w2')
  },
  {
    day: 15, week: 3, arc: 'Turn your skill into income', pillar: 'Education',
    platform: 'instagram', format: 'Reel',
    hook: 'Good with words? Four paths that pay through Payoneer or Wise.',
    paths: '3, 7, 13, 21', cta: 'Soft — take the test',
    utm_campaign: 'assessment-d15', hard_cta: false,
    cta_url: assessment('instagram', 'social', 'assessment-d15')
  },
  {
    day: 16, week: 3, arc: 'Turn your skill into income', pillar: 'Education',
    platform: 'instagram', format: 'Carousel',
    hook: 'Creative? Design → print-on-demand → templates.',
    paths: '2, 10, 19', cta: 'Soft — take the test',
    utm_campaign: 'assessment-d16', hard_cta: false,
    cta_url: assessment('instagram', 'social', 'assessment-d16')
  },
  {
    day: 17, week: 3, arc: 'Turn your skill into income', pillar: 'Education',
    platform: 'instagram', format: 'Reel',
    hook: 'Tech-savvy? Web dev, AI data work and user testing.',
    paths: '5, 23, 24', cta: 'Soft — take the test',
    utm_campaign: 'assessment-d17', hard_cta: false,
    cta_url: assessment('instagram', 'social', 'assessment-d17')
  },
  {
    day: 18, week: 3, arc: 'Turn your skill into income', pillar: 'Education',
    platform: 'instagram', format: 'Live / workshop',
    hook: 'Teach what you know: tutoring, e-books, paid workshops.',
    paths: '16, 17, 18', cta: 'Soft — take the test',
    utm_campaign: 'assessment-d18', hard_cta: false,
    cta_url: assessment('instagram', 'live', 'assessment-d18')
  },
  {
    day: 19, week: 3, arc: 'Turn your skill into income', pillar: 'Trust',
    platform: 'instagram', format: 'Carousel',
    hook: 'What GHS 0 really means — and when a small budget helps.',
    paths: '9 vs. 1, 2, 3, 8', cta: 'Soft — take the test',
    utm_campaign: 'assessment-d19', hard_cta: false,
    cta_url: assessment('instagram', 'social', 'assessment-d19')
  },
  {
    day: 20, week: 3, arc: 'Turn your skill into income', pillar: 'Trust',
    platform: 'instagram', format: 'Explainer post',
    hook: 'What happens after you unlock your result — the handoff, step by step.',
    paths: '', cta: 'Soft — take the test',
    utm_campaign: 'assessment-d20', hard_cta: false,
    cta_url: assessment('instagram', 'social', 'assessment-d20')
  },
  {
    day: 21, week: 3, arc: 'Turn your skill into income', pillar: 'Conversion',
    platform: 'instagram', format: 'Reel',
    hook: 'Not sure which of the 24 fits? Three questions.',
    paths: '', cta: 'Hard CTA — weekly push',
    utm_campaign: 'assessment-w3', hard_cta: true,
    cta_url: assessment('instagram', 'social', 'assessment-w3')
  },
  {
    day: 22, week: 4, arc: 'From a list to one plan', pillar: 'Education',
    platform: 'instagram', format: 'Reel',
    hook: 'You got a match. Now what? The first 48 hours.',
    paths: '1, 3, 8, 16', cta: 'Soft — unlock the guide',
    utm_campaign: 'assessment-d22', hard_cta: false,
    cta_url: assessment('instagram', 'social', 'assessment-d22')
  },
  {
    day: 23, week: 4, arc: 'From a list to one plan', pillar: 'Education',
    platform: 'instagram', format: 'Carousel',
    hook: 'A one-page plan: write these four lines tonight.',
    paths: '', cta: 'Soft — take the test',
    utm_campaign: 'assessment-d23', hard_cta: false,
    cta_url: assessment('instagram', 'social', 'assessment-d23')
  },
  {
    day: 24, week: 4, arc: 'From a list to one plan', pillar: 'Conversion',
    platform: 'instagram', format: 'Retargeted post',
    hook: '24 paths is a starting point, not a strategy. Pressure-test your top one.',
    paths: '', cta: 'Hard CTA — Anchor Session',
    utm_campaign: 'assessment-d24', hard_cta: true,
    cta_url: consultation('instagram', 'social', 'assessment-d24'),
    alt_url: assessment('instagram', 'social', 'assessment-d24')
  },
  {
    day: 25, week: 4, arc: 'From a list to one plan', pillar: 'Education',
    platform: 'instagram', format: 'Reel',
    hook: 'Complete beginner — where do I actually start?',
    paths: '1, 2, 3, 8, 12, 20', cta: 'Soft — take the test',
    utm_campaign: 'assessment-d25', hard_cta: false,
    cta_url: assessment('instagram', 'social', 'assessment-d25')
  },
  {
    day: 26, week: 4, arc: 'From a list to one plan', pillar: 'Trust',
    platform: 'instagram', format: 'Carousel',
    hook: 'No upfront fees, no fake promises — our three guardrails.',
    paths: 'Guardrails 1–3', cta: 'Soft — take the test',
    utm_campaign: 'assessment-d26', hard_cta: false,
    cta_url: assessment('instagram', 'social', 'assessment-d26')
  },
  {
    day: 27, week: 4, arc: 'From a list to one plan', pillar: 'Education',
    platform: 'instagram', format: 'Story sequence',
    hook: 'Poll "phone or laptop?" then show the matching paths.',
    paths: '1, 2, 8 vs. 4, 5, 16', cta: 'Soft — story link',
    utm_campaign: 'assessment-d27', hard_cta: false,
    cta_url: assessment('instagram', 'story', 'assessment-d27')
  },
  {
    day: 28, week: 4, arc: 'From a list to one plan', pillar: 'Conversion',
    platform: 'instagram', format: 'Direct post',
    hook: 'Last call this month: take the test, get the guide, book the session.',
    paths: '', cta: 'Hard CTA — month close',
    utm_campaign: 'assessment-w4', hard_cta: true,
    cta_url: assessment('instagram', 'social', 'assessment-w4')
  },
  {
    day: 29, week: 5, arc: 'Retarget and close', pillar: 'Education',
    platform: 'instagram', format: 'Retargeting Reel',
    hook: "Started the test but didn't finish? It takes 3 questions.",
    paths: '', cta: 'Soft — finish the test',
    utm_campaign: 'assessment-d29', hard_cta: false,
    cta_url: assessment('instagram', 'social', 'assessment-d29')
  },
  {
    day: 30, week: 5, arc: 'Retarget and close', pillar: 'Conversion',
    platform: 'newsletter', format: 'Recap + newsletter',
    hook: '30 days, 24 paths, one next step.',
    paths: 'Top 5 from engagement', cta: 'Hard CTA — assessment + consultation',
    utm_campaign: 'assessment-d30', hard_cta: true,
    cta_url: assessment('newsletter', 'email', 'assessment-d30'),
    alt_url: consultation('newsletter', 'email', 'assessment-d30-close')
  }
];

export default CONTENT_CALENDAR_PLAN;
