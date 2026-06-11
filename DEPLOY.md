# Deploy to gideonabochie.org

This project requires **Cloudflare Pages with Functions and D1** — it is NOT a static site.
Netlify and GitHub Pages will NOT work (they don't support D1 or Cloudflare Functions).

---

## Step 1: Cloudflare Pages (Git Integration)

1. Go to https://dash.cloudflare.com → **Workers & Pages** → **Pages**
2. Click **Create** → **Connect to Git**
3. Select the `gideonabochie-org` repository
4. Build settings (leave defaults — no build command, output dir = root):
   - **Build command**: (leave empty)
   - **Build output directory**: (leave as `/`)
   - **Root directory**: (leave as `/`)
5. Under **Environment variables (advanced)**, add the variables from Step 3 below
6. Click **Save and Deploy** — the site goes live at `<project>.pages.dev` in ~2 min

> **Important**: After first deploy, go to Pages → your project → **Functions** tab
> and verify that `api/db/setup` and other endpoints are listed.

---

## Step 2: D1 Database

1. In Cloudflare dashboard, go to **Workers & Pages** → **D1**
2. Click **Create database** → name it `gideonabochie-db` → **Create**
3. Go back to **Pages** → your project → **Settings** → **Functions**
4. Under **D1 database bindings**, click **Add binding**:
   - **Variable name**: `DB`
   - **D1 database**: select `gideonabochie-db`
5. **Redeploy** the project
6. Visit `https://<project>.pages.dev/api/db/setup` to initialize all tables
   - This creates: `subscribers`, `tasks`, `enrollments`, `contact_submissions`,
     `donations`, `event_log`, `book_purchases`, `phase_verifications`,
     `subscriptions`, `donor_phone`, `ci_reports`

---

## Step 3: Required Environment Variables

Add these to **Cloudflare Pages** → project → **Settings** → **Environment variables**:

| Variable | Required? | Description |
|---|---|---|
| `FLW_PLAN_SUPPORTER` | Yes | Flutterwave Payment Plan ID for Monthly Supporter (GH50/mo) |
| `FLW_PLAN_PATRON` | Yes | Flutterwave Payment Plan ID for Annual Patron (GH500/yr) |
| `FLW_PLAN_FOUNDING` | Yes | Flutterwave Payment Plan ID for Founding Partner (GH2500/yr) |
| `FLW_SECRET_KEY` | Yes | Flutterwave secret key (from Settings → API) |
| `FLW_SECRET_HASH` | Yes | Flutterwave webhook hash (set in webhook config) |
| `BREVO_API_KEY` | Yes | Brevo SMTP API key (for email automation) |
| `CRON_SECRET` | Yes | Shared secret for `/api/email/cron` (must match GitHub Actions secret) |
| `AGENT_AUTH_KEY` | Yes | Shared secret for `/api/agents/*` endpoints (must match GitHub Actions secret) |
| `CI_WEBHOOK_SECRET` | If using CI | Shared secret between GitHub Actions and this endpoint |

Each variable should have values for **Production** (and optionally Preview).

---

## Step 4: Flutterwave Webhook

1. Go to Flutterwave dashboard → **Settings** → **Webhook**
2. Set the webhook URL to: `https://<project>.pages.dev/api/payments/flutterwave`
3. Set a **Secret Hash** (any random string)
4. Copy that hash as `FLW_SECRET_HASH` in Cloudflare env vars
5. Copy your **Secret Key** from Settings → API as `FLW_SECRET_KEY`

### Recurring Payment Plans (in Flutterwave dashboard)

These are already configured in the code with these IDs — no env vars needed
unless you want to override for different environments:

| Plan | Amount | Interval | ID |
|---|---|---|---|
| Monthly Supporter | GH 50 | Monthly | `160302` |
| Annual Patron | GH 500 | Yearly | `160303` |
| Founding Partner | GH 2500 | Yearly | `160304` |

To override (e.g., for staging), set `FLW_PLAN_SUPPORTER`, `FLW_PLAN_PATRON`,
`FLW_PLAN_FOUNDING` env vars in Cloudflare Pages.

---

## Step 5: Brevo SMTP (Email Automation)

1. Go to https://brevo.com → login → **SMTP & API** → **SMTP Keys**
2. Create a new key, copy it as `BREVO_API_KEY` in Cloudflare env vars
3. The system uses this for:
   - Welcome emails after subscription/donation
   - Email receipts for book purchases
   - Newsletter queue processing
   - Contact form auto-replies

---

## Step 6: GitHub Actions (CI/CD + Cron)

1. Go to repo → **Settings** → **Secrets and variables** → **Actions**
2. Add the following secrets:
   - `CI_WEBHOOK_SECRET` — same value used in Cloudflare env vars
   - `CLOUDFLARE_API_TOKEN` — Cloudflare API token with **Cloudflare Pages** edit permissions
   - `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID (for D1 backup script)
   - `CRON_SECRET` — shared secret for `/api/email/cron` endpoint, must match `CRON_SECRET` in Cloudflare env vars
   - `AGENT_AUTH_KEY` — shared secret for `/api/agents/*` endpoints, must match `AGENT_AUTH_KEY` in Cloudflare env vars
3. The pipeline runs automatically on every push/PR to `main`:
   - **Test phase**: lint JS, lint HTML, unit tests, coverage, E2E, audit, secrets scan, asset checks
   - **Deploy phase**: only on push to `main`, after all tests pass, deploys to Cloudflare Pages via `wrangler pages deploy`
4. Results post to your admin dashboard at `/admin/`

### Automated Cron Workflows

| Workflow | Schedule | What it does |
|---|---|---|
| `email-cron.yml` | Every hour | Processes email queue (abandoned donations), drains pending agent queue items (cold outreach, analytics, fulfillment) |
| `backup.yml` | Daily at midnight UTC | Dumps all D1 tables to JSON, uploads as 7-day retention artifact |

---

## Step 7: Custom Domain

1. In Cloudflare Pages → your project → **Custom domains**
2. Click **Set up a custom domain** → enter `gideonabochie.org`
3. Follow DNS instructions (add CNAME or update nameservers)
4. Cloudflare auto-provisions SSL — site is served over HTTPS

---

---

## Guitar Course: One-Time Setup

The guitar course runs on the same Cloudflare Pages project and D1 database. After the initial deploy:

### Initialize Guitar Tables

1. Visit `https://<project>.pages.dev/api/guitar/setup` — this creates 12 `guitar_*` tables and seeds:
   - 16 modules across 3 tiers (Bronze 1-5, Silver 6-11, Gold 12-16)
   - 64 lessons with full HTML content
   - 15 Ghanaian songs (highlife, gospel, hiplife)
   - 20 achievements/badges
2. Verify with `https://<project>.pages.dev/api/guitar/modules` — should return all 16 modules

### Flutterwave Paywall

The guitar course uses **Flutterwave** for a one-time GH₵ 99 course unlock (Modules 6+).
No additional env vars are needed — the existing `FLW_SECRET_KEY` and `FLW_SECRET_HASH` are reused.

Webhook endpoint: `POST /api/guitar/enroll/webhook` (auto-configured alongside main webhook).

### Enrollment Flow

| Step | Endpoint | Description |
|---|---|---|
| Check status | `GET /api/guitar/enroll/status` | `{tier: "free"/"registered"/"premium"}` |
| Register (free) | `POST /api/guitar/enroll` with `{plan: "free"}` | Creates user stats, enables Modules 1-5 |
| Purchase | `POST /api/guitar/enroll` with `{plan: "premium"}` | Returns Flutterwave checkout URL, redirect user |
| Webhook | `POST /api/guitar/enroll/webhook` | Flutterwave calls this on payment success, unlocks Modules 6-16 |

### D1 Tables (guitar_*)

All prefixed with `guitar_` to avoid clashes with existing tables:
- `guitar_modules`, `guitar_lessons`, `guitar_songs`
- `guitar_user_stats`, `guitar_lesson_progress`
- `guitar_practice_sessions`, `guitar_one_minute_records`
- `guitar_achievements`, `guitar_user_achievements`
- `guitar_leaderboard_history`
- `guitar_enrollments`, `guitar_enrollment_log`

---

## Step 8: Post-Deploy Verification Checklist

- [ ] Visit `/api/db/setup` — returns `"Tables ready"`
- [ ] Visit homepage — all sections render, no JS errors in console
- [ ] Visit `/support/` — tier cards load, currency toggle works
- [ ] Visit `/school/` — programs listed, only Genesis is active
- [ ] Visit `/books/` — book cards load, download modal appears
- [ ] Visit `/admin/` — redirects to Cloudflare Access login
- [ ] Make a test donation — Flutterwave modal opens
- [ ] Visit `/admin/` — dashboard shows CI/CD card (after first CI run)
- [ ] Verify `/books/*.pdf` direct access returns 403 rewrite
- [ ] Check `/api/payments/flutterwave` webhook responds (test in Flutterwave)
- [ ] Visit `/api/guitar/setup` — returns `"Guitar tables ready"`
- [ ] Visit `/api/guitar/modules` — returns 16 modules with lessons
- [ ] Visit `/school/guitar/` — landing page renders with animated hero and curriculum
- [ ] Visit `/school/guitar/learn/` — module grid loads, lesson content plays YouTube
- [ ] Visit `/school/guitar/practice/` — timer, metronome, one-minute drill all render
- [ ] Visit `/school/guitar/tuner/` — canvas needle and cents meter render, mic prompt appears
- [ ] Visit `/school/guitar/dashboard/` — stat counters render (may show zeros for new user)
- [ ] Visit `/school/guitar/songs/` — song cards load with filter pills
- [ ] Test enrollment: `POST /api/guitar/enroll {"plan":"free"}` returns 200
- [ ] Verify desktop layout ≥1024px: sidebar replaces bottom nav
