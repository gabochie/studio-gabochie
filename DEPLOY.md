# Deploy to studio.gabochie.com

This project requires **Cloudflare Pages with Functions and D1** — it is NOT a static site.
Netlify and GitHub Pages will NOT work (they don't support D1 or Cloudflare Functions).

---

## Step 1: Cloudflare Pages (Git Integration)

1. Go to https://dash.cloudflare.com → **Workers & Pages** → **Pages**
2. Click **Create** → **Connect to Git**
3. Select the `studio-gabochie` repository
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
2. Click **Create database** → name it `gahq` → **Create** (this name is pinned in `wrangler.json`, `scripts/db-setup.js`, and the CI migration check — do not rename it without updating all three)
3. Go back to **Pages** → your project → **Settings** → **Functions**
4. Under **D1 database bindings**, click **Add binding**:
   - **Variable name**: `DB`
   - **D1 database**: select `gahq`
5. **Redeploy** the project
6. Initialize tables either from CI (`npm run db:setup`, blocking) or, for a first manual setup, from `https://<project>.pages.dev/api/db/setup`.
   - The endpoint creates the full schema defined in `functions/api/db/setup.js` (including `subscribers`, `donations`, `bookings`, `users`, `sessions`, `ci_reports`, `quality_runs`, `quality_reports`, `expresspay_tokens`, and `guitar_*` tables).
   - It returns **JSON**, not a plain-text string:
     `{"status":"ok","tables":<count>,"results":[…],"failed":[],"failed_count":0}`.
     Any failed statement returns HTTP 500 with `status:"error"` and a populated `failed` array; that is a failed deploy/setup.

---

## Step 3: Required Environment Variables

Add these to **Cloudflare Pages** → project → **Settings** → **Environment variables**:

| Variable | Required? | Description |
|---|---|---|
| `EXPRESSPAY_MERCHANT_ID` | Yes | ExpressPay merchant ID (sandbox: 306264946940) |
| `EXPRESSPAY_API_KEY` | Yes | ExpressPay API key (keep secret — never commit) |
| `EXPRESSPAY_LIVE` | For live | Set to `1` for production (default is sandbox) |
| `MOMO_NUMBER` / `MOMO_NAME` | Optional | Manual MoMo wallet override (default: merchant 0559624456 / GABOCHIE DESIGN) |
| `BANK_NAME` / `BANK_ACCOUNT_NAME` / `BANK_ACCOUNT_NUMBER` / `BANK_BRANCH` | For bank transfers | Manual bank-transfer details; unset = guided to email instead |
| `BREVO_API_KEY` | Yes | Brevo SMTP API key (for email automation) |
| `CRON_SECRET` | Yes | Shared secret for `/api/email/cron`; send it in the `X-Cron-Secret` header, never in the query string |
| `AGENT_AUTH_KEY` | Yes | Shared secret for `/api/agents/*` endpoints (must match GitHub Actions secret) |
| `CI_WEBHOOK_SECRET` | Yes | Shared secret between GitHub Actions and `/api/admin/ci/status` + `/admin/api/qa/scan` |
| `ADMIN_API_KEY` | Yes | Shared secret for admin API routes (must match the value used for admin access) |
| `GEMINI_API_KEY` | For audio workflow | Google AI Studio key used by `lotl-audio.yml` / `scripts/lotl-tts.cjs` |

Each variable should have values for **Production** (and optionally Preview).

---

## Step 4: ExpressPay Webhook (post-url)

No dashboard registration is needed: every checkout submit sends
`post-url=https://<project>.pages.dev/api/gateways/expresspay/callback`,
and ExpressPay posts final MoMo/card statuses there. The callback re-queries
ExpressPay before settling, so forged posts cannot unlock anything.

Tiers are one-time charges per period (no auto-renewal): the
`tier_renewal` cron step emails members before `membership_expires_at`.

> Sandbox test cards: Visa `4846801111111119` (CVV 123, exp 12/26),
> MoMo success wallet `233541111111`, fail wallet `233542222222`.
> Network coverage to verify on-device before claiming: complete one sandbox
> checkout each with an MTN, Telecel, and AT test wallet.

---

## Step 4b: Crypto & DeFi Payments (NOWPayments + on-chain)

Crypto works in two modes — no code changes needed, only env vars and
dashboard setup:

1. **NOWPayments invoices (recommended):** donor picks any of 200+ coins on a
   hosted invoice; settlement auto-confirms via IPN webhook.
   1. Go to https://nowpayments.io → **API Keys** → create a key → set as
      `NOWPAYMENTS_API_KEY` in Cloudflare env vars.
   2. Go to **Settings → IPN** (or store settings) → set the callback URL to
      `https://studio.gabochie.com/api/gateways/crypto/webhook`.
   3. Copy the **IPN Secret** as `NOWPAYMENTS_IPN_SECRET` (enables HMAC-SHA512
      verification of every callback).
   4. Set `PUBLIC_BASE_URL` to `https://studio.gabochie.com` (used for invoice
      success/cancel URLs).
2. **Manual on-chain (fallback):** when no NOWPayments key is set, the API
   returns receive addresses and `POST /api/gateways/crypto/verify` confirms
   the tx on-chain (BTC, TRON, BSC, Polygon, Ethereum, Solana). Set the
   public receive addresses (never private keys):
   - `CRYPTO_BTC_ADDRESS` — Bitcoin
   - `CRYPTO_USDT_ADDRESS` — USDT-TRC20 (Tron)
   - `CRYPTO_TRX_ADDRESS` — native TRX (optional)
   - `CRYPTO_EVM_ADDRESS` — one address reused for BSC/Polygon/Ethereum
     (USDT/USDC + native coins)
   - `CRYPTO_SOL_ADDRESS` — Solana (SOL + USDC/USDT SPL)
3. Optional: `GHS_USD_RATE` pins the GHS→USD rate (else live rate, else
   an emergency 12 GHS/USD fallback is recorded with `rate_stale: true`.
    Stale-rate invoices must be reconciled manually; verification tolerates
    ±2% FX drift against the rate recorded on the invoice.
 4. Public price displays use `GET /api/rates` (6-hour edge cache, live provider,
    `source` and `stale` fields). No page calls a third-party FX API directly.

Crypto accepts **donations, course upgrades, book purchases, tier
subscriptions, and merch orders** — the `purpose` is recorded in the payment
row and the matching product is activated on confirmation.

| Variable | Required? | Description |
|---|---|---|
| `NOWPAYMENTS_API_KEY` | For invoice mode | NOWPayments API key |
| `NOWPAYMENTS_IPN_SECRET` | Recommended | IPN callback HMAC secret |
| `PUBLIC_BASE_URL` | For invoice mode | Canonical site URL for callbacks |
| `CRYPTO_BTC_ADDRESS` | For manual mode | BTC receive address |
| `CRYPTO_USDT_ADDRESS` | For manual mode | USDT-TRC20 receive address |
| `CRYPTO_TRX_ADDRESS` | Optional | Native TRX receive address |
| `CRYPTO_EVM_ADDRESS` | For manual mode | EVM receive address (BSC/Polygon/ETH) |
| `CRYPTO_SOL_ADDRESS` | For manual mode | Solana receive address |
| `GHS_USD_RATE` | Optional | Pinned GHS-per-USD rate for crypto invoices (display rates come from `/api/rates`) |

---

## Step 4c: Selar Hosted Checkout (No Secrets)

Selar is a hosted storefront, not a gateway module — it needs **no env vars, webhook or server-side verification** on this site. Anything bought on Selar settles in Selar and is fulfilled there.

1. On Selar's free Starter plan, create your products (books, bundle, courses, guitar registration) and a **Show Love / donation** product.
2. Copy each product's Quick Checkout URL (`https://selar.com/<product>?quickcheckout=1`).
3. Paste them into `assets/js/selar-links.js` → `CONFIG`:
   - `donation` → `/donate/` "Support on Selar" button (prefills name + email)
   - `products.books`, `products.bundle`, `products.courses`, `products.guitar`
   - `store` → optional fallback storefront for product buttons
4. Paste the three consultation product links into `assets/js/consultation-config.js` → `CONFIG.selar`.

Blank links hide their buttons automatically, so a deploy with placeholders is safe. Nothing is settled from a Selar redirect — do **not** auto-unlock site access or mark a donation paid from a return URL.

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
   - `CRON_SECRET` — shared secret for `/api/email/cron` endpoint, must match `CRON_SECRET` in Cloudflare env vars (sent as `X-Cron-Secret`)
   - `AGENT_AUTH_KEY` — shared secret for `/api/agents/*` endpoints, must match `AGENT_AUTH_KEY` in Cloudflare env vars
   - `GEMINI_API_KEY` — Google AI Studio key for the audio workflow
   - `GH_RULESET_TOKEN` — optional PAT with ruleset read access; when set, `protection-policy-check` verifies all required status checks
3. The pipeline runs automatically on every push/PR to `main`:
   - **Test phase**: lint JS, lint HTML, HTML validation, a11y, unit tests, coverage, static E2E, full-stack E2E (local D1 + mock gateway), audit, gitleaks, asset checks, protection-policy check
   - **Deploy phase**: only on push to `main`, after all required checks pass. Deploys are serialized (`concurrency: deploy-main`, no cancellation), then `npm run predeploy`, Cloudflare Pages deploy, blocking `npm run db:setup`, migration verification, smoke checks, and a blocking QA scan. Any failure stops the release.
4. Results post to your admin dashboard at `/admin/`.
5. In GitHub → Settings → Rules → Rulesets, make `main` protected and require the status checks listed in `.github/workflows/ci.yml` (`Lint JavaScript`, `Lint HTML`, `HTML Validator`, `Accessibility audit`, `Unit & API tests`, `Test coverage`, `E2E tests`, `Full-stack E2E (D1 + mock gateway)`, `Security audit`, `Secrets scan`, `Asset checks`, `Protection policy check`) plus the `gitleaks` check from `secret-scan.yml`. Require at least one approving review and dismiss stale approvals. This is a manual GitHub-side step; CI only verifies it when `GH_RULESET_TOKEN` is configured.

### Automated Cron Workflows

| Workflow | Schedule | What it does |
|---|---|---|
| `email-cron.yml` | Every hour | Processes email queue (abandoned donations), drains pending agent queue items (cold outreach, analytics, fulfillment) |
| `backup.yml` | Daily at midnight UTC | Dumps all D1 tables to JSON, uploads as 7-day retention artifact |

### Rollback runbook (manual, production)

Assets and D1 data are separate. Roll back the Pages deployment first, then decide whether the D1 schema/data needs a restore.

1. Find the last known-good deployment ID (CI records current and previous IDs in the deploy job, or list them):
   ```bash
   curl -fsS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
     "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/studio-gabochie/deployments?per_page=10" \
     | jq -r '.result[] | [.id, .created_on, .latest_stage.status, (.deployment_trigger.metadata.commit_hash // "")] | @tsv'
   ```
2. Roll back production to that deployment:
   ```bash
   curl -fsS -X POST -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
     "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/studio-gabochie/deployments/$GOOD_DEPLOYMENT_ID/rollback"
   ```
3. Run the smoke checks from the deploy job (`/api/db/ping` and critical pages) and confirm the dashboard CI card reports the older run.
4. **D1 is not rolled back automatically.** If a migration changed data, restore from the newest good `backup.yml` artifact using `npx wrangler d1 execute gahq --remote --file=<dump>.sql` (or the equivalent JSON import), then re-verify critical tables.

**Monthly drill (manual):** download the most recent `backup.yml` artifact, restore it into a *throwaway* D1 database (never production), run `npm run db:setup` against it, and confirm row counts for `subscribers`, `donations`, `users`, and `guitar_enrollments`. Record the date and outcome. A backup that has never been restored is not a backup.

---

## Step 7: Custom Domain

1. In Cloudflare Pages → your project → **Custom domains**
2. Click **Set up a custom domain** → enter `studio.gabochie.com`
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

### ExpressPay Paywall

The guitar course uses **ExpressPay** (and Moolre MoMo, and crypto via
NOWPayments) for a tiered unlock ladder — prices are admin-configurable via
D1 `settings` (`guitar_price_bronze`, `guitar_price_silver`,
`guitar_price_gold`, `guitar_price_apprentice`; fallbacks 299/199/299/699).
No additional env vars are needed — the existing `EXPRESSPAY_*` keys are reused.

Tier ladder (cumulative; Silver presupposes Bronze, Gold presupposes Silver):

| Plan | Price | Unlocks |
|---|---|---|
| `bronze` | GH¢ 299 | Registration — the Bronze foundation (Modules 1–5 after the free preview) |
| `silver` | GH¢ 199 | Songcraft (Modules 6–11) + the song library |
| `gold`   | GH¢ 299 | Expression (Modules 12–16) + certificate |
| `apprentice` | GH¢ 699 | All 16 modules in one decision — saves vs the ladder total |
| `full` (legacy) | `guitar_price` setting | Everything — kept for backward compatibility |

Settlement: `POST /api/gateways/expresspay/callback` (shared post-url), which
completes the pending `guitar_payments` row and emails the receipt.

### Enrollment Flow

| Step | Endpoint | Description |
|---|---|---|
| Check status | `GET /api/guitar/enroll/status` | `{tier, unlocked, bronzeUnlocked, silverUnlocked, goldUnlocked, songLibraryUnlocked, freeModules}` |
| Register (free) | `POST /api/guitar/register` | Creates user stats, enables free modules |
| Purchase | `POST /api/guitar/enroll` (auth), body `{plan}` | Returns `tx_ref` + price for the plan; pay via `POST /api/gateways/expresspay/create`, redirect user to `checkout_url` |
| Callback | `POST /api/gateways/expresspay/callback` | ExpressPay post-url; query-verified, unlocks the purchased tier + receipt |

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

- [ ] Visit `/api/db/setup` — returns JSON `{"status":"ok", ...}` with `failed_count: 0` (CI runs this as a blocking step; never call it on production outside a release unless you are deliberately repairing the schema)
- [ ] Visit homepage — all sections render, no JS errors in console
- [ ] Visit `/support/` — tier cards load, currency toggle works
- [ ] Visit `/school/` — programs listed, only Genesis is active
- [ ] Visit `/books/` — book cards load, download modal appears
- [ ] Visit `/admin/` — redirects to Cloudflare Access login
- [ ] Make a GH¢1 test donation — ExpressPay checkout opens (sandbox card above)
- [ ] Visit `/admin/` — dashboard shows CI/CD card (after first CI run)
- [ ] Verify `/books/*.pdf` direct access returns 403 rewrite
- [ ] Test ExpressPay callback: `POST /api/gateways/expresspay/callback` with sandbox order settles + receipts
- [ ] Visit `/api/guitar/setup` — returns `"Guitar tables ready"`
- [ ] Visit `/api/guitar/modules` — returns 16 modules with lessons
- [ ] Visit `/school/guitar/` — landing page renders with animated hero and curriculum
- [ ] Visit `/school/guitar/learn/` — module grid loads, lesson content plays YouTube
- [ ] Visit `/school/guitar/practice/` — timer, metronome, one-minute drill all render
- [ ] Visit `/school/guitar/tuner/` — canvas needle and cents meter render, mic prompt appears
- [ ] Visit `/school/guitar/dashboard/` — stat counters render (may show zeros for new user)
- [ ] Visit `/school/guitar/songs/` — song cards load with filter pills
- [ ] Test enrollment: `POST /api/guitar/enroll {"plan":"bronze"}` (auth) returns a pending `tx_ref`
- [ ] Verify desktop layout ≥1024px: sidebar replaces bottom nav
