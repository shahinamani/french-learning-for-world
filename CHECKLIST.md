# Release checklist

Controls from `SECURITY.md`, `AUTHENTICATION.md`, `DATA.md`, `HACK.md`, with what
is actually true. **A written policy or a passing build is not proof a control
works** — evidence is a path plus a check that has been seen to fail.

Verified **2026-10-08** against `main`.

| control | status | evidence |
|---|---|---|
| Server-side authorization | **N/A** — no server; nothing rendered is access control | `docs/deploying.md` |
| Tenant isolation | **N/A** as a boundary; per-profile separation exists and is tested, but not against the device owner | `lib/session.ts`; walk "multi-user isolation" |
| Auth, MFA, session expiry/revocation, rate limits, lockout, CSRF, trusted-proxy IP | **N/A today; MISSING once a server exists** — no credential to protect | `AUTHENTICATION.md`, all values proposed |
| Secrets absent from code, bundle, URLs, logs, fixtures, config | **IMPLEMENTED** — none exist; no `import.meta.env`/`process.env` in `web/src` | `pre-push-sweep.sh` 1; CI secret scan |
| Placeholder-only example env | **N/A** — nothing to configure; rule stands for the first secret | `SECURITY.md` |
| Personal data absent from tracked files | **PARTIAL** — local sweep catches a regex-escaped address, **CI does not** | `pre-push-sweep.sh` 3 vs `ci.yml` |
| Authorship guard | **IMPLEMENTED**, seen refusing | `.githooks/commit-msg`, `tests/commit-attribution.test.js` |
| CI secret scan of history | **IMPLEMENTED** — fails on an implausibly small dump, so an empty read cannot pass | `.github/workflows/ci.yml` |
| Dev write endpoint never in a build | **IMPLEMENTED** — three independent assertions | `tests/review-tool-is-dev-only.test.js` |
| Only the reviewer recorded as reviewer | **IMPLEMENTED** after the tool once forged one | `tests/review-sheets.test.js` |
| CSP, HSTS, framing, permissions headers | **IMPLEMENTED**, tested by serving the real build with them | `web/public/_headers` |
| HSTS preload **submission** | **MISSING, deliberately** — months-long commitment, Shahin's alone | `_headers` comment |
| XSS surface | **IMPLEMENTED** — no `dangerouslySetInnerHTML`/`innerHTML` in `web/src`; no script `unsafe-inline` | that grep, empty |
| Backup and **tested** restore | **IMPLEMENTED** — study, export, erase, import, rows return | `web/e2e/walk.mjs` |
| Import of malformed input | **PARTIAL** — `parseExport` untested against bad data | `lib/progress.ts` |
| Security audit log | **N/A today** — nothing to audit; requirements written | `DATA.md` |
| Bounded logs, no full-request logging | **IMPLEMENTED by absence** — nothing logged off-device | `reviewsForUser(userId, limit)` |
| Resource limits (first-load budget) | **IMPLEMENTED** — build fails over 150 KB JS / 30 KB CSS and verifies its own asset list | `web/scripts/budget.mjs` |
| Dependency scanning | **MISSING** — lockfiles committed, no Dependabot, no `npm audit` | no `.github/dependabot.yml` |
| Production debug restrictions | **PARTIAL** — the walk fails on console errors; nothing forbids logging profile data | `web/e2e/walk.mjs` |
| Private vulnerability reporting | **IMPLEMENTED** | `SECURITY.md` |

## Before merging anything security-sensitive

Run the three commands in `HACK.md` → Verification, all green. If headers
changed, serve `dist/` **with `_headers` applied**. If a write path was added,
repeat the review-tool analysis in `SECURITY.md`. If a secret was touched,
rotate first. Then update the date above — a stale verification date is a claim
nobody has checked.

## Prioritised gaps

1. **CI's personal-data pattern lags the local sweep**, so a local pass and a CI
   pass mean different things — the divergence that cost a day in October.
2. **No dependency scanning.** The CSP removes the CDN path; a malicious npm
   package is the realistic supply-chain route into a build.
3. **`parseExport` is untested against hostile input** — the only parser reading
   a learner-supplied file, and restore is the sole recovery path.

Each is tooling or tests, not authentication, thresholds, secrets or
infrastructure, and none is made by this documentation task.
