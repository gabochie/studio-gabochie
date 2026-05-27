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

1. Go to **Settings** → **Payment Plans**
2. Create 3 plans:
   | Plan | Amount | Interval | Token | 
   |---|---|---|---|
   | Monthly Supporter | GH 50 | Monthly | `FLW_PLAN_SUPPORTER` |
   | Annual Patron | GH 500 | Yearly | `FLW_PLAN_PATRON` |
   | Founding Partner | GH 2500 | Yearly | `FLW_PLAN_FOUNDING` |
3. Copy each plan's ID (a number like `1234`) into the corresponding env var

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

## Step 6: GitHub Actions (CI/CD)

1. Go to repo → **Settings** → **Secrets and variables** → **Actions**
2. Add the same `CI_WEBHOOK_SECRET` used in Cloudflare env vars
3. The CI pipeline runs automatically on every push/PR to `main`
4. Results post to your admin dashboard at `/admin/`

---

## Step 7: Custom Domain

1. In Cloudflare Pages → your project → **Custom domains**
2. Click **Set up a custom domain** → enter `gideonabochie.org`
3. Follow DNS instructions (add CNAME or update nameservers)
4. Cloudflare auto-provisions SSL — site is served over HTTPS

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
