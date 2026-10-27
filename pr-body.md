## Consultation page — 3 session levels, documents, booking terms

New productized offer for Gideon's advisory time (brainstorm decisions: **3 levels, anchors-not-prices, 4 tracks, request-to-book**).

### New
- **`/consultation/`** — hero + proof strip (honest facts), 3-level ladder (Anchor Session 60min → Coaching Sprint 4-pack → Advisory Retainer), 4 tracks (Systems Thinking & Strategy · Church & Ministry Leadership · Guitar & Music Program Setup · Creative Projects & Brand), 4-step process (request → confirm & pay → meet → written notes), "Offerings & Documents" section, booking form, 6 FAQs.
- **`/consultation/overview`** — board/boss/spouse-ready printable one-pager.
- **`/legal/consultation`** — Booking & Session Terms (8 sections): pay-after-confirmation, reschedule ≥24h free, no-show forfeiture, sprint pro-rata, advice-not-execution + no-guarantee disclaimer, confidentiality, client owns their content. Template — flagged for owner review.

### Backend: zero new infrastructure
Booking form posts FormData to the **existing** `/api/services/inquiry` (service = "Consultation — <level>", description carries track + message, Turnstile-protected, honeypot included) → lands in the **existing** admin/services.html inbox + emails Gideon.
Also hardened that endpoint: malformed (non-form) bodies now get HTTP 400 with a clear message instead of a masked 500.

### Wiring
- `nav.js` footer: Consultation added to Offerings
- `/services/`: "Just Need Advice, Not a Project?" strip routes advisory demand to /consultation/
- `search/pages.json`: consultation entry added

### Verified
Playwright iPhone 13: all sections, CTA→form pre-select (sprint), live form POST hits the endpoint (CAPTCHA-verified path), one-pager + legal render, zero overflow, zero page errors. 436/436.
