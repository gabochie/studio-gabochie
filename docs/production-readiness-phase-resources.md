# Production-readiness phase — resources, agents and teams used

This document is an audit trail for the phase that started after the content-calendar
work was merged (`main @ 481bd15`). It records every agent, team, tool, script and
human decision used to produce the audit report, the remediation pass and the QA
pilot. No application code was committed by the audit itself; the fixes were made
on branch `fix/production-readiness`.

---

## 1. Phase scope

| Stage | Goal | Status at time of writing |
|---|---|---|
| A. Full build audit | Critically audit the entire build and produce an HTML report with a "fool list" of tests, prelaunch tasklist, ongoing tests, CI gates, runbook and sign-off | Complete — 5 audits integrated |
| B. Remediation | Fix everything fixable in code, then update the report with fix status and the remaining manual actions | Five teams complete; final residual-fix cleanup pass running for the 8 findings outside their ownership |
| C. QA pilot | Build a human-in-the-loop agent that executes the checklist autonomously and pauses before risky actions | Built and documented; not yet run against production |

---

## 2. Agent / team roster

All agents were `general`-type subagents launched via the `subagent` tool. Each was
given **exclusive ownership of a file set** so parallel work could not collide.
None were allowed to commit.

### 2.1 Audit streams (Stage A)

| Team | Session ID | Scope | Result |
|---|---|---|---|
| Security & payments audit | (earlier stream, ID not retained in the session log) | Auth, OTP, webhooks, gateways, invoices, middleware, rate limiting | Integrated — SEC-01…SEC-19 |
| Data / cron reliability audit | (earlier stream, ID not retained) | D1 setup, email queue, WhatsApp queue, agents, newsletter, cron, outreach | Integrated — DAT-01…DAT-31 |
| CI / tests / deploy / ops audit | (earlier stream, ID not retained) | GitHub workflows, package scripts, secrets, coverage, release/rollback | Integrated — OPS-01…OPS-18 |
| Revenue funnel audit | (earlier stream, ID not retained) | Money-Ghana pages, subscribe flow, analytics, calendar CTAs, admin revenue | Integrated — REV-01…REV-12 |
| Frontend / UX / SEO / accessibility / PWA audit | `ses_df2b1f398ffeDIEJQ6lV6hMlai` | 109 HTML pages, shared CSS/JS, PWA, headers, redirects, sitemaps | Integrated — FE-01…FE-27; found the reflected XSS blocker |

### 2.2 Remediation teams (Stage B)

| Team | Session ID | Description label | Ownership (abridged) | Status |
|---|---|---|---|---|
| Security & payments | `ses_df29fcf8effeYvqDdeUCiWNP0w` | Fix security and payments | `functions/api/**` claim, brevo webhook, gateways, invoices, auth, middleware, rate-limit | **Complete** — 13 FIXED, 1 PARTIAL (SEC-02 message tag lives in data-owned files; later closed by DAT-08); 11 targeted files / 172 tests passed; OPS-02 auth wiring handed to data team |
| Residual cleanup | `ses_df269a8b0ffe6h5JKBNPSuWoNU` | Fix residual findings | Access JWT, rate limit/Turnstile, admin auth helper, newsletter test send, backup timestamp, sitemap lastmod, homepage JSON-LD | **Complete** — all 8 FIXED; 69 files / 619 tests passed, lint/lint:html/diff-check clean |
| Revenue-path audit | `ses_df240793dffeekQSBbIZDRvMa9` | Map revenue surfaces and prices | Offers, prices, checkout config, lead forms, scheduling automation, analytics, D1 money tables | **Complete** — Selar 100% blank, ExpressPay sandbox-default, Moolre/NOWPayments/WhatsApp/Brevo blank; real prices and `/admin/api/revenue` streams documented; feeds report section 1A |
| Frontend / SEO / a11y | `ses_df29f85aaffe9rbN4RgOFbmSkM` | Fix frontend SEO accessibility | Store pages, 404, consultation, courses, shared CSS/JS, `sw.js`, `nav.js`, `_headers`, robots/sitemap, key HTML pages | **Complete** — 25 FIXED, 2 PARTIAL, 1 out-of-scope; W3C validation passes, ESLint clean, 11 frontend tests + 116 unit tests passed |
| Data / cron / queues / agents | `ses_df29f351dffels8SEcRYOsXEBh` | Fix data cron queues agents | `functions/api/db/setup.js`, `functions/api/email/**`, `functions/admin/api/newsletter/**`, `functions/api/agents/**`, `scripts/db-*.js`, SQL migrations | **Complete** — 26 FIXED, 5 PARTIAL; OPS-02 and OPS-03 closed (authenticated POST-only setup, real `getStatements()` export). Full suite `npx vitest run` → 66 files / 588 tests passed |
| Revenue funnel | `ses_df29eeb9fffeYv2o25DYwqk2kF` | Fix revenue funnel | `money-ghana/**`, `assets/js/money-ghana.js`, `assets/js/consultation-config.js`, `functions/api/subscribe*`, analytics, admin revenue, calendar plan/doc | **Complete** — 12/12 items FIXED or PARTIAL; 8 test files / 35 tests passed |
| CI / release / ops | `ses_df29ea024ffe8WntM7MKSkPoa3` | Fix CI release ops | `.github/workflows/**`, `package.json`, `wrangler.json`, `vitest.config.js`, `playwright.config.js`, `DEPLOY.md`, `README.md`, `.env.example`, CI status endpoint, QA scan | **Complete** — 14 FIXED, 2 PARTIAL, 1 BLOCKED (DB endpoint auth owned by another agent); `npm audit` 0 vulnerabilities, 7 workflows parse OK, 23 tests passed |

### 2.3 How the teams were coordinated

1. `git status -sb` confirmed `main...origin/main` clean.
2. `git checkout -b fix/production-readiness` created an isolated branch.
3. Five subagents were dispatched in parallel, each with:
   - an explicit list of files it owns,
   - an explicit **do not touch** list covering the other teams' files,
   - the exact finding IDs and acceptance criteria to implement,
   - instructions to preserve response shapes, use existing code style, run targeted tests, and **not commit**,
   - a required final report format: `FIXED / PARTIAL / BLOCKED` per finding plus test commands and manual actions.
4. A sixth workstream (the main session) prepared the report's fix-status UI and the QA pilot, which touch none of the agents' files.

---

## 3. Tools and harness resources used

| Resource | What it was used for |
|---|---|
| `subagent` tool (`general` agent) | Ten agents total: five read-only audits + five remediation teams |
| `shell` tool | Git branch/status, JS syntax validation, checklist generation, HTMLHint/ESLint/Vitest commands run by agents |
| `execute` tool (Code Mode) | `tools.browser.*` calls: reload, evaluate DOM, console-error capture, click testing of filters and checkboxes |
| `browser` tool | Preview tab `tab_7df693ad-4998-4916-8ef8-56ad6e91a030` at `http://127.0.0.1:8765/production-readiness-audit.html` — verified rendering, zero console errors, P0/P1 filters, checkbox persistence |
| `question` tool | Asked the human which QA layer to build first; answer: **Full QA pilot (Recommended)** |
| `read` / `write` / `edit` tools | Read report state; wrote the HTML report, QA files and this document; applied surgical edits to the report JS/CSS |
| `glob` / `grep` tools | Locate source files and finding locations during the audit |
| `webfetch` / `websearch` | Not used in this phase |
| `skill` tool — `wrangler` | Loaded before the final `wrangler pages functions build` verification to follow current CLI guidance; no deploy was performed |

---

## 4. Temporary scripts (outside the repo)

| Path | Purpose |
|---|---|
| `C:\Users\user\AppData\Local\Temp\opencode\check-report.js` | Parses the report's embedded JavaScript, checks syntax and counts findings / prelaunch / ongoing rows. Last run: `JS syntax OK — findings: 81 prelaunch: 55 ongoing: 17` (the 81 is the extracted array length before all FE rows were confirmed; rendered table count is 108). |
| `C:\Users\user\AppData\Local\Temp\opencode\serve-audit.js` | Temporary local HTTP server used to preview the Desktop HTML report in the in-app browser on port 8765. |
| `C:\Users\user\AppData\Local\Temp\opencode\build-qa-checklist.js` | Extracts `PRELAUNCH` and `ONGOING` arrays from the report and writes `qa/checklist.json` with auto/approval classification. Output: `72 checks; 16 require approval`. |

These scripts are disposable harness tooling and are intentionally not committed.

---

## 5. Deliverables and artifacts

| Artifact | Location | Note |
|---|---|---|
| Production-readiness report | `C:\Users\user\Desktop\GABOCHIE BOOKS\STUDIO MANUAL TODOS\TEst Suite\production-readiness-audit.html` | Single self-contained HTML file: 108 findings (9 P0), 55 prelaunch checks, 17 ongoing checks, 23 CI gates, runbook, sign-off, fix-status column, Manual actions section |
| QA checklist (machine-readable) | `qa/checklist.json` | 72 checks generated from the report; 16 require human approval |
| QA pilot protocol | `qa/README.md` | dry-run / safe / full modes, stop conditions, evidence format, limitations |
| QA pilot agent prompt | `qa/agent-prompt.md` | Self-contained prompt for a general-purpose subagent |
| QA results (created on first run) | `qa/results/latest.json`, `qa/results/latest.md` | Evidence and human summary |
| Remediation branch | `fix/production-readiness` | Local branch with all in-progress fixes; no commits made by this phase |
| This resource log | `docs/production-readiness-phase-resources.md` | The document you are reading |

Browser state used for verification: `localStorage` key `sg-prod-audit-v2` stores checkbox
progress; filters were verified with P0 → 9 rows and prelaunch P1 → 18 rows.

---

## 6. Human decisions recorded

| Decision | Source | Outcome |
|---|---|---|
| Which QA layer to build first | `question` tool, answered by the user | **Full QA pilot** — agent executes the 55 prelaunch checks via browser/shell/API, pauses before risky steps, writes results into the report |
| Earlier scheduler/content-calendar implementation | Prior phase | Approved and merged as PR #237 (`481bd15`); `/money-ghana/` remains primary conversion hub; social posts are manual copy-and-post reminders |

---

## 7. Final verification (all teams complete)

| Check | Result |
|---|---|
| `npm test` | **69 files / 619 tests passed** |
| `npm run lint` | 0 errors, 71 pre-existing warnings |
| `npm run lint:html` | 141 files, 0 errors |
| `git diff --check` | No whitespace errors (LF → CRLF notices only) |
| `wrangler pages functions build` | Compiled successfully (Wrangler 4.125.0) |
| `node check-report.js <report>` | JS syntax OK; 108 rendered findings, 55 prelaunch, 17 ongoing |
| Browser preview | Zero console errors; filters and localStorage persistence verified |
| Report status counts | **96 FIXED, 12 PARTIAL, 0 OPEN, 0 BLOCKED; 0 of 9 P0 blockers open** |
| Final report UX upgrade | Added a data-driven launch-readiness dashboard (40% code fixes + 35% manual steps + 25% prelaunch checks; ongoing cadence shown separately), converted the manual actions into 21 numbered, tickable steps across 6 ordered phases, expanded each with exact steps and a "done when" test, and added a 24 Nov verification snapshot. Browser-verified: 21 step cards, 21 expandable guides, 2 verified-done steps seeded (readiness 39%), ticking M-09 recalculates both readiness and the fastest-to-money list, and all state persists across reload. |

The twelve PARTIAL items are hardening follow-ups (mostly operational or architectural),
not launch blockers. The report's Manual actions section holds the 21 items that require
human Cloudflare/GitHub/provider access or a real-world decision.

### 7a. Manual-action verification snapshot (24 Nov 2026)

Checked from public production endpoints, the GitHub API, git refs and local files. Secret
values cannot be proven from outside the dashboard, so credential-dependent steps are marked
"Cannot verify" rather than assumed done.

| Result | Steps |
|---|---|
| **Verified done (2)** | M-01 branch committed and pushed; M-08 hourly email cron succeeding on `main` |
| **Partial (3)** | M-02 ruleset active but 0 approvals and 10 of 13 checks; M-04 sitemap fixed locally but not live; M-12 D1 ping works but migrations unproven |
| **Not done (7)** | M-09 Selar URLs blank in production; M-13/M-14 backup workflow failing 3 consecutive days; M-16 not deployed (`main` @ `481bd15`); M-18 production SW `v24` vs repo `v25`; M-20 QA pilot not run; M-21 no live checkout |
| **Cannot verify (9)** | M-03, M-05, M-06, M-07, M-10, M-11, M-15, M-17, M-19 — need dashboard access, admin key or human browser/editorial judgement |

Additional findings: PR #238 is open for `fix/production-readiness`; the `gitleaks`
false positive on test-fixture tokens was cleared so the branch can be merged.

### 7b. Cloudflare verification limits

The shared dashboard URL (`dash.cloudflare.com/.../home`) cannot be read without an
authenticated session or API token, and both `wrangler whoami` and `gh auth status` report
expired credentials in this environment. To let the agent verify Cloudflare state read-only,
either:

1. Run `wrangler login` interactively, then re-run the checks; or
2. Create a scoped API token with Account Read, Pages Read, D1 Read and R2 Read, and set
   `CLOUDFLARE_API_TOKEN`.

Useful read-only commands afterwards: `wrangler pages project list`,
`wrangler pages deployment list --project-name studio-gabochie`,
`wrangler pages secret list --project-name studio-gabochie`,
`wrangler d1 list`, `wrangler r2 bucket list`.

---

## 8. Remaining work for the human

1. Fix the failing `gitleaks` check, open a PR for `fix/production-readiness` and merge it.
2. Complete the 21 manual actions in the report. Start with the verification snapshot: only M-01 and M-08 are confirmed done.
3. Set the live Selar URLs and ExpressPay credentials — without them there is no way to take money.
4. Fix the backup workflow; it has failed three days in a row.
5. Deploy, then re-run the prelaunch checklist or run the QA pilot in `safe` / `full` mode via `qa/agent-prompt.md`.
6. Run `npm run db:setup` against production D1 after deploy.
7. After the final commit, regenerate `sitemap.xml` `lastmod` values so they match the new commit dates.
