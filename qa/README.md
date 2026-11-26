# QA Pilot — human-in-the-loop release testing

This folder turns the audit report's tasklists into something an agent can actually run.

## Files

| File | Purpose |
|---|---|
| `checklist.json` | The single source of truth. Generated from `production-readiness-audit.html` so the human checklist and the agent checklist never drift. 72 checks; 16 are marked `mode: "approval"`. |
| `agent-prompt.md` | Ready-to-use prompt for a general-purpose subagent. It tells the agent how to run checks, when to stop, and how to record evidence. |
| `results/` | Agent output: `latest.json` (machine-readable) and `latest.md` (human summary). Created on the first run. |
| `revenue-pilot.md` | Human-in-the-loop protocol for the report's "Fastest path to money" feature: prerequisites, approval gates, operating loop, stop conditions. |
| `revenue-agent-prompt.md` | Copy/paste prompt that puts an agent into `observe` mode and enforces the approval gates. |

## Three operating modes

- **dry-run** — read-only checks only. No form submissions, no emails, no payments. Use this against production at any time.
- **safe** — runs all `mode: "auto"` checks, using synthetic data (unique `+qa-<timestamp>` email addresses, test gateway tokens, scratch records). Stops before anything real.
- **full** — runs everything, pausing with a `question` before each `mode: "approval"` check. The human can confirm, modify, skip, or abort.

## Human-in-the-loop rules

The agent **must** pause before a check when any of these are true:

1. `check.mode === "approval"`.
2. The check could send a real email, move real money, publish public content, unsubscribe a real person, delete production data, or rotate a secret.
3. The check needs a credential the agent does not already have in the environment.

The pause message must say exactly what will happen, which account/order/email is affected, and what the agent will do if confirmed. "Confirm", "skip", and "abort" are the only outcomes.

## Stop conditions

- Any P0 check fails → halt immediately, record the failure, and report.
- Three consecutive unexpected failures → halt; a broken harness produces false failures.
- The browser is not attached → report `BLOCKED`, do not retry indefinitely.
- Never print secrets, tokens, or full request bodies containing PII into the report.

## Evidence

For each check record:

```json
{
  "id": "PL-06",
  "status": "PASS | FAIL | SKIPPED | BLOCKED",
  "mode": "auto",
  "priority": "P0",
  "checkedAt": "2026-11-24T12:00:00Z",
  "observed": "Short factual observation",
  "evidence": ["screenshot path", "status code", "response body summary"],
  "note": "Anything the human needs to decide"
}
```

## Limitations

- Browser tools require the OpenCode desktop app to be attached.
- Agents are good at following a checklist, not at judging subtle visual quality. Anything subjective stays with the human.
- Deterministic assertions belong in CI (see the 23 CI gates in the report), not in LLM judgment.
- This pilot does not replace the prelaunch sign-off; it supplies the evidence for it.
