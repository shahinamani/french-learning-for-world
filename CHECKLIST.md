# Release checklist

Controls from `SECURITY.md`, `AUTHENTICATION.md`, `DATA.md`, `HACK.md`, with what
is true today. **A written policy or a passing build is not proof a control
works** — evidence is a path plus a check that has been seen to fail.

Verified **2026-10-08** against `main`.

| control | status | evidence |
|---|---|---|
| Server-side authorization | **N/A** — no server; nothing rendered is access control | `docs/deploying.md` |
| Tenant isolation | **N/A** as a boundary; per-profile separation exists and is tested, not against the device owner | `web/src/lib/session.ts`; `web/e2e/walk.mjs` |
| Auth · MFA · session expiry/revocation · rate limits · lockout · CSRF · trusted-proxy IP | **N/A today; MISSING once a server exists** — no credential to protect | `AUTHENTICATION.md` (all values proposed) |
| Secrets absent from code, bundle, URLs, logs, fixtures, config; placeholder-only example env | **IMPLEMENTED** — none exist, none configurable (no `import.meta.env`/`process.env` in `web/src`); example-env rule binds the first secret | `scripts/pre-push-sweep.sh` 1; `.github/workflows/ci.yml` |
| Personal data absent from tracked files | **IMPLEMENTED** — one script for both callers, catches a regex-escaped address, prints locations only | `scripts/check-personal-data.sh`; `tests/personal-data-scan.test.js` (8 cases) |
| Authorship guard | **IMPLEMENTED**, seen refusing | `.githooks/commit-msg`; `tests/commit-attribution.test.js` |
| Secret scan of full history | **IMPLEMENTED** — fails on an implausibly small dump, so an empty read cannot pass | `.github/workflows/ci.yml` |
| Dev write endpoint never in a build | **IMPLEMENTED** — three independent assertions | `tests/review-tool-is-dev-only.test.js` |
| Only the reviewer recorded as reviewer | **IMPLEMENTED** after the tool once forged one | `tests/review-sheets.test.js`; `scripts/apply-review.py` |
| CSP · HSTS · framing · permissions headers | **IMPLEMENTED**, tested by serving the real build | `web/public/_headers` |
| HSTS preload **submission** | **MISSING, deliberately** — a months-long commitment, Shahin's alone | `web/public/_headers` |
| XSS surface | **IMPLEMENTED** — no `dangerouslySetInnerHTML`/`innerHTML` in `web/src`; no script `unsafe-inline` | that grep, empty; `web/public/_headers` |
| Backup and **tested** restore | **IMPLEMENTED** — study, export, erase, import, rows return | `web/e2e/walk.mjs` |
| Import of malformed, oversized and hostile input | **IMPLEMENTED** — 18 parser cases plus 9 browser checks that a rejected file leaves existing rows untouched | `tests/parse-export.test.js`; `web/e2e/walk.mjs` |
| Security audit log | **N/A today** — nothing to audit; requirements written | `DATA.md` |
| Bounded logs, no full-request logging | **IMPLEMENTED by absence** — nothing logged off-device; bounded queries | `web/src/lib/progress.ts` |
| Resource limits (first-load budget) | **IMPLEMENTED** — build fails over 150 KB JS / 30 KB CSS and verifies its own asset list | `web/scripts/budget.mjs` |
| Dependency scanning | **IMPLEMENTED** — blocks on production advisories at high+, reports dev-only. Triaged 2026-10-08: react-router 7.9.1 → 7.18.4 (XSS, production); vite, source-map-js and playwright accepted as dev-only | `scripts/check-dependencies.sh`; `tests/dependency-scan.test.js` |
| Production debug restrictions | **PARTIAL** — the walk fails on console errors; nothing forbids logging profile data | `web/e2e/walk.mjs` |
| Private vulnerability reporting | **IMPLEMENTED** | `SECURITY.md` |

## Before merging

`HACK.md` → Verification, all green. Headers changed → serve `dist/` **with
`_headers` applied**. A write path added → repeat the review-tool analysis in
`SECURITY.md`. A secret touched → rotate first. Then update the date above: a
stale one is a claim nobody has checked.

## Gaps

The three recorded on 2026-10-08 are closed; see the rows above for evidence.
What remains:

1. **Dev-only advisories are reported, not fixed** — vite 7.1.5 (Windows-only
   `server.fs.deny` bypass), source-map-js (transitive, DoS), playwright 1.55.0
   (browser-download SSL verification). None reaches a learner's browser. Each
   is a deliberate acceptance with a date, not an oversight.
2. **Production debug restrictions** remain PARTIAL: nothing forbids logging
   profile data.
3. **Two unexplained browser-run crashes** on 2026-10-08 are recorded as
   unexplained in `docs/lessons.md`, not as resolved. Diagnostics were added so
   a recurrence leaves evidence.
