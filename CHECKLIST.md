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
| Personal data absent from tracked files | **PARTIAL** — the local sweep catches a regex-escaped address, **CI does not** | `scripts/pre-push-sweep.sh` step 3 vs `.github/workflows/ci.yml` |
| Authorship guard | **IMPLEMENTED**, seen refusing | `.githooks/commit-msg`; `tests/commit-attribution.test.js` |
| Secret scan of full history | **IMPLEMENTED** — fails on an implausibly small dump, so an empty read cannot pass | `.github/workflows/ci.yml` |
| Dev write endpoint never in a build | **IMPLEMENTED** — three independent assertions | `tests/review-tool-is-dev-only.test.js` |
| Only the reviewer recorded as reviewer | **IMPLEMENTED** after the tool once forged one | `tests/review-sheets.test.js`; `scripts/apply-review.py` |
| CSP · HSTS · framing · permissions headers | **IMPLEMENTED**, tested by serving the real build | `web/public/_headers` |
| HSTS preload **submission** | **MISSING, deliberately** — a months-long commitment, Shahin's alone | `web/public/_headers` |
| XSS surface | **IMPLEMENTED** — no `dangerouslySetInnerHTML`/`innerHTML` in `web/src`; no script `unsafe-inline` | that grep, empty; `web/public/_headers` |
| Backup and **tested** restore | **IMPLEMENTED** — study, export, erase, import, rows return | `web/e2e/walk.mjs` |
| Import of malformed input | **PARTIAL** — `parseExport` untested against bad data | `web/src/lib/progress.ts` |
| Security audit log | **N/A today** — nothing to audit; requirements written | `DATA.md` |
| Bounded logs, no full-request logging | **IMPLEMENTED by absence** — nothing logged off-device; bounded queries | `web/src/lib/progress.ts` |
| Resource limits (first-load budget) | **IMPLEMENTED** — build fails over 150 KB JS / 30 KB CSS and verifies its own asset list | `web/scripts/budget.mjs` |
| Dependency scanning | **MISSING** — lockfiles committed, no Dependabot, no `npm audit` | `package-lock.json`; no `.github/dependabot.yml` |
| Production debug restrictions | **PARTIAL** — the walk fails on console errors; nothing forbids logging profile data | `web/e2e/walk.mjs` |
| Private vulnerability reporting | **IMPLEMENTED** | `SECURITY.md` |

## Before merging

`HACK.md` → Verification, all green. Headers changed → serve `dist/` **with
`_headers` applied**. A write path added → repeat the review-tool analysis in
`SECURITY.md`. A secret touched → rotate first. Then update the date above: a
stale one is a claim nobody has checked.

## Prioritised gaps

1. **CI's personal-data pattern lags the local sweep**, so a local pass and a CI
   pass mean different things — the divergence that cost a day in October.
2. **No dependency scanning.** The CSP removes the CDN path; a malicious npm
   package is the realistic route into a build.
3. **`parseExport` is untested against hostile input** — the only parser reading
   a learner-supplied file, and restore is the sole recovery path.

All three are tooling or tests — not authentication, thresholds, secrets or
infrastructure — and none was made by the change that added these files.
