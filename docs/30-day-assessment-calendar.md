# 30-Day Assessment-Led Content Calendar

**Status:** Draft
**Funnel hub:** `/money-ghana/` — 3-question online income assessment
**Primary platforms:** Instagram + TikTok (short video), with carousel/story repurposing
**Secondary:** Facebook, WhatsApp broadcast, LinkedIn/X (repurpose only)

## Goal

Use the assessment as the **primary conversion destination**, not as the only thing we post. Social content earns attention and trust; the assessment captures it and hands it to the existing email → consultation ladder.

```
post → assessment (UTM) → 3 questions → match #1 → email unlock
     → printable guide → day-3 email → consultation → Anchor Session
```

The day-3 consultation email and lead-source reporting already exist (`README.md:65`). Do not duplicate them manually.

## UTM convention

Define two base links:

- `A` = `https://studio.gabochie.com/money-ghana/`
- `C` = `https://studio.gabochie.com/consultation/`

Every link uses:

```
?utm_source=<platform>&utm_medium=<placement>&utm_campaign=assessment-dXX
```

| Placement | `utm_source` | `utm_medium` |
|---|---|---|
| Instagram feed/reel | `instagram` | `social` |
| Instagram story | `instagram` | `story` |
| TikTok | `tiktok` | `social` |
| Facebook | `facebook` | `social` |
| WhatsApp broadcast/status | `whatsapp` | `broadcast` |
| LinkedIn / X | `linkedin` / `x` | `social` |

**Important:** `functions/api/subscribe.js` only stores `utm_source`, `utm_medium` and `utm_campaign`. Put the day/week in `utm_campaign` (`assessment-d08`, `assessment-w2`) — `utm_content` will not survive into the subscriber record.

Swap the link-in-bio URL each day to that day's `A?...` link.

## Content mix

Roughly **60% education/reach, 25% trust, 15% direct conversion**. "Wired to the assessment" means every post gives people a reason to take the test — but only ~5 posts/day-marked **Hard CTA** ask outright.

Weekly arcs:

1. **Days 1–7 — "Is this even possible in Ghana?"** Broad reach, introduce the 24 paths and the guardrails.
2. **Days 8–14 — "Phone + GHS 0"** The smartphone-only, no-capital segment.
3. **Days 15–21 — "Turn your skill into income"** Creative / tech / writing / teaching segments.
4. **Days 22–28 — "From a list to one plan"** Objections, proof, consultation handoff.
5. **Days 29–30 — Retarget and close.**

Path numbers refer to `assets/js/money-ghana-data.js` (`methods[].id`).

## Daily calendar

| Day | Pillar | Format | Hook / caption starter | Path(s) | CTA + UTM campaign |
|---|---|---|---|---|---|
| 1 | Education | Reel / TikTok | "24 legal ways to make money online in Ghana. Here are 5 you can start with a phone." | 1, 2, 3, 8, 12 | Soft — link in bio `assessment-d01` |
| 2 | Education | Carousel | "Phone-only + GHS 0: six paths that actually fit." | 1, 2, 3, 8, 12, 14 | Soft — "Comment PHONE" + story `assessment-d02` |
| 3 | Trust | Reel | "3 signs an 'online job' is a scam in Ghana." | Guardrails 1–3 | Soft — "See the safe list" `assessment-d03` |
| 4 | Education | Carousel | "MoMo, Payoneer, Wise — which payout should you chase first?" | Intro note; 3, 5, 7, 20 | Soft — "Match to a payout path" `assessment-d04` |
| 5 | Trust | Founder post | "Why I built a 3-question test instead of another ebook." | — | Soft — "Try it" `assessment-d05` |
| 6 | Conversion | Story sequence + bio | "2 minutes, 3 questions, your #1 path." Poll: phone or laptop? | — | **Hard CTA** — story link `assessment-d06` |
| 7 | Education | Recap post + newsletter | "The question you asked most this week: where do I start?" | 1, 2, 3, 8 | Soft — `assessment-w1` |
| 8 | Education | Reel | "Design flyers on your phone with Canva and get paid via MoMo." | 2 | Soft — "Comment DESIGN" `assessment-d08` |
| 9 | Education | Carousel | "Social media management from a phone: the first 3 steps." | 1 | Soft — `assessment-d09` |
| 10 | Education | Reel | "Copywriting with no capital: one paragraph that sells." | 3 | Soft — `assessment-d10` |
| 11 | Education | WhatsApp broadcast | "Sell Makola/Kantamanto stock on WhatsApp Status — no rent, no shop." | 8 | Soft — direct link `utm_source=whatsapp&utm_medium=broadcast&utm_campaign=assessment-d11` |
| 12 | Education | Carousel | "UGC and brand sponsorships: what Ghanaian brands actually pay for." | 14 | Soft — `assessment-d12` |
| 13 | Trust | Reel | "Why we left survey sites off the list." | Guardrail 3 | Soft — "See the 24" `assessment-d13` |
| 14 | Conversion | Challenge post | "Phone-only challenge: take the test, screenshot your match, tag us." | — | **Hard CTA** — `assessment-w2` |
| 15 | Education | Reel | "Good with words? Four paths that pay through Payoneer or Wise." | 3, 7, 13, 21 | Soft — `assessment-d15` |
| 16 | Education | Carousel | "Creative? Design → print-on-demand → templates." | 2, 10, 19 | Soft — `assessment-d16` |
| 17 | Education | Reel | "Tech-savvy? Web dev, AI data work and user testing." | 5, 23, 24 | Soft — `assessment-d17` |
| 18 | Education | Live / workshop | "Teach what you know: tutoring, e-books, paid workshops." | 16, 17, 18 | Soft — `assessment-d18` |
| 19 | Trust | Carousel | "What GHS 0 really means — and when a small budget helps." | 9 vs. 1, 2, 3, 8 | Soft — `assessment-d19` |
| 20 | Trust | Explainer post | "What happens after you unlock your result — the handoff, step by step." | — | Soft — `assessment-d20` |
| 21 | Conversion | Reel | "Not sure which of the 24 fits? Three questions." | — | **Hard CTA** — `assessment-w3` |
| 22 | Education | Reel | "You got a match. Now what? The first 48 hours." | 1, 3, 8, 16 | Soft — "Unlock the guide" `assessment-d22` |
| 23 | Education | Carousel | "A one-page plan: write these four lines tonight." | — | Soft — `assessment-d23` |
| 24 | Conversion | Retargeted post | "24 paths is a starting point, not a strategy. See your match first, then pressure-test it." | — | **Hard CTA** — assessment first: `/money-ghana/?utm_source=instagram&utm_medium=social&utm_campaign=assessment-d24`; consultation second (for people who already unlocked a match): `/consultation/?from=money-ghana&utm_source=instagram&utm_medium=social&utm_campaign=assessment-d24` |
| 25 | Education | Reel | "Complete beginner — where do I actually start?" | 1, 2, 3, 8, 12, 20 | Soft — `assessment-d25` |
| 26 | Trust | Carousel | "No upfront fees, no fake promises — our three guardrails." | Guardrails 1–3 | Soft — `assessment-d26` |
| 27 | Education | Story sequence | Poll "phone or laptop?" then show the matching paths. | 1, 2, 8 vs. 4, 5, 16 | Soft — story link `assessment-d27` |
| 28 | Conversion | Direct post | "Last call this month: take the test, get the guide, book the session." | — | **Hard CTA** — `assessment-w4` |
| 29 | Education | Retargeting Reel | "Started the test but didn't finish? It takes 3 questions." | — | Soft — `assessment-d29` |
| 30 | Conversion | Recap + newsletter | "30 days, 24 paths, one next step." | Top 5 from engagement | **Hard CTA** — assessment first: `/money-ghana/?utm_source=newsletter&utm_medium=email&utm_campaign=assessment-d30`; consultation second, only for unlocked leads: `/consultation/?from=money-ghana&utm_source=newsletter&utm_medium=email&utm_campaign=assessment-d30-close` |

## Production rhythm

- **Two shoot blocks per week** (e.g. Monday and Thursday): batch 6–8 short videos.
- One carousel can be built from each week's most-commented question.
- Stories go out daily: poll or question sticker in the morning, link sticker in the afternoon.
- WhatsApp broadcast goes out once a week (Day 11 is the template); keep it practical, not promotional.
- Reuse each Reel as a TikTok, Facebook Reel and LinkedIn video with the platform's own UTM source.

## Running it from the admin dashboard

The plan is executable from **`/admin/content-calendar.html`** (sidebar → Content → Content Calendar), not just this document.

1. Visit **`/api/db/setup`** once after deploy. It creates the `social_queue` table, adds `scheduled_at` / `utm_campaign` to `posts`, and seeds the 30 days with unique `plan_key` values. Re-running is safe: `INSERT OR IGNORE` preserves edits.
2. In the Content Calendar, filter by week / platform / status. Due items are **copy-and-post reminders** — copy the link, publish manually on the platform, then mark **Posted**. The hourly cron flips due items from Planned/Ready to **Due**; it does not auto-post to social platforms.
3. For blog articles, use **Blog Manager** (`/admin/blog.html`). Set status **Scheduled** plus a future **Scheduled for** date; the hourly cron (`/api/email/cron`, protected by `CRON_SECRET`) flips it to Published when due. A future-dated **Published** post is also hidden from `/api/posts`, SSR, search and the sitemap until its date arrives.
4. `scripts/content-calendar-plan.js` is the shared source of truth for the seed and the campaign URLs. Edit it there, then re-run DB Setup for new days (existing rows keep their admin edits).

## Measurement

Checkpoints on **Days 7, 14, 21 and 30**:

| Metric | Where |
|---|---|
| Leads by source/campaign | `admin/revenue.html` → Lead sources |
| Consultation referrals | `GET /admin/api/revenue` (`money-ghana-assessment`) |
| Settled bookings vs. pipeline | `admin/revenue.html` (pipeline is never counted as revenue) |
| Engagement by format | Platform analytics; compare Reel vs. carousel vs. story |

**Funnel events:** `assets/js/money-ghana.js` records `assessment_start`, `assessment_complete` and `assessment_unlock` with the visitor's five UTM parameters via `/api/event`. See the Income Assessment Funnel card in `admin/analytics.html` for the start → complete → unlock conversion rates. Judge the calendar on that funnel plus leads and bookings, not clicks alone.

## Guardrails for execution

- Keep the voice legal, ethical and unhyped — no "quick cash" claims.
- Always name the payout route (MoMo / bank / Payoneer / Wise) when mentioning a path.
- Never invent earnings figures or testimonials. Use "here's how it works", not "here's how much I made".
- Do not send people straight to consultation before they have seen their match; the unlocked result is what makes the Anchor Session pitch credible.
