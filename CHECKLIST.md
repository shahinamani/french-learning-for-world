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
| Import of malformed, oversized and hostile input | **IMPLEMENTED** — 24 parser cases plus 9 browser checks that a rejected file leaves existing rows untouched; bounded at 50 MB / 150 000 rows, refused **before** the file is read | `web/src/lib/export-format.ts`; `tests/parse-export.test.js`; `web/src/routes/Account.tsx` |
| Security audit log | **N/A today** — nothing to audit; requirements written | `DATA.md` |
| Bounded logs, no full-request logging | **IMPLEMENTED by absence** — nothing logged off-device; bounded queries | `web/src/lib/progress.ts` |
| Resource limits (first-load budget) | **IMPLEMENTED** — build fails over 150 KB JS / 30 KB CSS and verifies its own asset list | `web/scripts/budget.mjs` |
| Dependency scanning | **IMPLEMENTED** — blocks on production advisories at high+, reports dev-only, and reports an unreachable registry distinctly (exit 2, never "clean"). **No advisory retained**: all nine fixed on 2026-10-08, see below | `scripts/check-dependencies.sh`; `tests/dependency-scan.test.js` (8 cases) |
| Production debug restrictions | **PARTIAL** — the walk fails on console errors; nothing forbids logging profile data | `web/e2e/walk.mjs` |
| Private vulnerability reporting | **IMPLEMENTED** | `SECURITY.md` |

## Before merging

`HACK.md` → Verification, all green. Headers changed → serve `dist/` **with
`_headers` applied**. A write path added → repeat the review-tool analysis in
`SECURITY.md`. A secret touched → rotate first. Then update the date above: a
stale one is a claim nobody has checked.

## Advisories, 2026-10-08 — all fixed, none retained

An earlier version of this file accepted four of these as "dev-only". That was
too quick: a dev-server advisory is a risk to a **developer machine and to CI**,
which run that server, even though it never reaches a learner's bundle. Listed
in full because an exception has to be auditable, and because the first
assessment missed that several were file-read bugs in a server we run.

| advisory | package, affected | prerequisite | reaches | action |
|---|---|---|---|---|
| GHSA-7mvr-c777-76hp | playwright `<1.55.1` | MITM of the browser download | dev + CI | → 1.55.1 |
| GHSA-p9ff-h696-f583 | vite `7.0.0–7.3.1`, high | dev server running; attacker page or exposed `--host` | **dev + CI, arbitrary file read** | → 7.3.7 |
| GHSA-v2wj-q39q-566r | vite `7.1.0–7.3.1`, high | as above, `server.fs.deny` bypass via query | dev + CI | → 7.3.7 |
| GHSA-fx2h-pf6j-xcff | vite `7.0.0–7.3.4`, high | as above, Windows alternate paths | dev on Windows | → 7.3.7 |
| GHSA-4w7w-66w2-5vf9 | vite `7.0.0–7.3.1` | dev server, optimized-deps `.map` traversal | dev + CI | → 7.3.7 |
| GHSA-93m4-6634-74q7 | vite `7.1.0–7.1.10` | Windows, backslash `fs.deny` bypass | dev on Windows | → 7.3.7 |
| GHSA-v6wh-96g9-6wx3 | vite `7.0.0–7.3.4` | Windows, UNC path, launch-editor | dev on Windows | → 7.3.7 |
| GHSA-68fv-2mgg-jv7q | source-map-js `<1.2.2`, high | crafted source map at build | build | → 1.2.2 (lockfile) |
| (react-router) | `7.9.1`, high XSS | production bundle | **learners** | → 7.18.4 |

Verified after upgrading: `npm audit` reports **0 vulnerabilities in both trees**,
the build is clean, and 324 browser checks pass on the new toolchain. **Nothing
is retained as an exception**, so there is no review trigger to record. If one
is ever accepted, it belongs in this table with a date and a trigger.

## Still open

1. **Production debug restrictions** remain PARTIAL: nothing forbids logging
   profile data.
2. **Two unexplained browser-run crashes** on 2026-10-08 remain **unexplained**,
   not resolved (`docs/lessons.md`). Diagnostics now report the last section,
   progress, server reachability and the stack — and earned themselves
   immediately by naming an unrelated crash (a missing browser after the
   playwright upgrade) in one line. The original crash has not recurred and no
   new evidence has been captured; it is not being re-investigated without
   some.
