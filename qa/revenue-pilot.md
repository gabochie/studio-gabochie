# Revenue pilot — autonomous execution with a human in the loop

This is the operating protocol for letting an agent drive the **fastest path to money** in
`production-readiness-audit.html` (section 1A) without letting it make irreversible business
decisions for you.

The agent may **observe, rank, draft and verify**. You decide anything that spends money,
publishes to the public, contacts a real person, changes a credential, or changes production data.

---

## 1. What you must supply before the first cycle

| # | Prerequisite | Why it cannot be delegated | Done? |
|---|---|---|---|
| 1 | Real checkout destination (Selar URL or configured payment gateway) and the price you actually want to charge | Only you own the merchant account and the decision to sell | [ ] |
| 2 | `TURNSTILE_SECRET` in production | Public forms fail closed (403) without it, so no lead can reach you | [ ] |
| 3 | `ADMIN_API_KEY`, `CF_ACCESS_TEAM`, `CF_ACCESS_AUD`, `BREVO_API_KEY`, `BREVO_WEBHOOK_SECRET` in production | Admin and notifications are gated by these; only the credential owner can set them | [ ] |
| 4 | `npm run db:setup` executed against production D1, and `/api/db/ping` green | Orders/subscribers need the schema to exist | [ ] |
| 5 | Deployed origin with all CI gates green, and a verified rollback point | An agent cannot deploy from a broken build | [ ] |
| 6 | Conversion inputs for the revenue model: daily qualified visitors, realistic conversion rate, average order value, selling days/month | These are business facts, not code facts. No historical conversion data exists in the repo | [ ] |
| 7 | A written ad-spend cap and content budget (can be ₵0) | The agent must know the ceiling before it proposes any paid action | [ ] |
| 8 | An approval channel and response time (e.g. you check the session twice a day) | Irreversible steps pause until you answer | [ ] |
| 9 | A kill switch: who disables the cron trigger / pauses the agent, and how | Needed to stop a bad cycle within minutes | [ ] |
| 10 | An owner for the ongoing test cadence in section 4 of the report | Revenue growth must not outrun reliability | [ ] |

---

## 2. Modes

| Mode | What the agent does | What it never does |
|---|---|---|
| `observe` | Read-only checks, ranks the recommendation list, reports blockers and the money model | No writes, no submissions, no drafting to external systems |
| `draft` | Everything in `observe`, plus locally drafted social posts, emails, pricing notes and a proposed publication schedule | Nothing is published, sent, deployed or purchased |
| `live` | Everything in `draft`, plus execution of already-approved routine steps (QA checks, reconciliation, metric refresh) | Any new irreversible action pauses for Confirm / Skip / Abort |

Start with `observe`, then `draft`, then `live` only after the prerequisites above are ticked.

---

## 3. Actions that ALWAYS require your explicit approval

The agent must pause with a plain-language prompt stating **what will happen, which account or
person is affected, and the exact irreversible effect**:

1. Committing, pushing, merging or deploying any change.
2. Setting, rotating or deleting any secret or environment variable.
3. Enabling or changing a live checkout URL, price, discount, or refund policy.
4. Spending money (ads, boosters, tooling) above the agreed cap — in fact, any spend the first time.
5. Publishing public content, including scheduled social posts and comments.
6. Sending a real email, SMS or WhatsApp message to a real person.
7. Submitting a real test payment, issuing a refund, or touching real order/subscriber data.
8. Deleting production data or changing a production schema.
9. Adding or changing a cron trigger or automation schedule.

Only **Confirm**, **Skip** and **Abort** are valid outcomes. Silence is not a Confirm.

---

## 4. The loop, per cycle

1. **Observe** — run the read-only QA checks (`qa/checklist.json`, mode `dry-run`) and re-read the
   report's fix status, readiness score and section 7 ticks.
2. **Rank** — recompute the section 1A recommendation list: money-unlocked-per-hour, blockers
   first, dependencies respected. Report the top three with their prerequisite and ETA.
3. **Propose** — for each of the top three, state the exact human action needed, the expected
   money effect, the risk, and the rollback. Draft any content locally.
4. **Ask** — pause on every approval-gated action. Batch related asks, but never bundle an
   irreversible action into an unrelated approval.
5. **Execute** — perform only the steps you confirmed, in dependency order.
6. **Verify** — re-run the affected prelaunch check, confirm the checkout link resolves, confirm
   a test lead/order is recorded correctly, then record evidence.
7. **Report** — write `qa/results/revenue-latest.md`: what earned money, what is still blocked,
   what was approved, what was skipped, and the updated daily/weekly/monthly model with your
   real inputs.

Recommended cadence while selling: one `observe` cycle daily, one `draft` cycle before each
content batch, and a `live` cycle only when you are present to approve.

---

## 5. Stop conditions

- Any P0 QA check fails → halt the revenue cycle and report.
- A payment callback cannot be verified against the provider → halt and report; never settle manually.
- Three consecutive unexpected failures → halt; a broken harness creates false confidence.
- An approval is unavailable for more than your agreed response time → skip that action, do not retry forever.
- A real customer is affected by an experiment → stop, escalate, and document.

Never print secrets, tokens, full payment payloads or personal data into the report.

---

## 6. Honest limits

- The repo has no historical conversion, traffic or revenue data. Any daily money figure comes
  from **your** four inputs in the report; the model is arithmetic, not a forecast.
- Agents are reliable at checklists and reconciliation, not at judging brand voice or subtle
  UX. Those stay with you.
- Deterministic assertions belong in CI, not in LLM judgment.
- Paid traffic and public posting are subject to each platform's rules. No fake engagement,
  impersonation, or automated account creation is in scope.

See `qa/README.md` and `qa/agent-prompt.md` for the release QA pilot that supplies sign-off evidence.
