# Threat scenarios and authorized testing

**Defensive.** What could go wrong here, how we would know, what we would do — so
controls are tested rather than assumed. Not a guide to attacking anything.

**Authorization.** Test only against a local build or a branch deployment you
control. **No exploitation, scanning or load testing against production, a third
party, or the examination bodies' sites.** `frenchmavie.com` is not deployed;
scanning GitHub or Cloudflare needs their written permission, which nobody has
sought.

## Applicable here

**Secret leakage.** Nothing to leak today; hooks and CI scan tree and history
(`scripts/pre-push-sweep.sh`, `.github/workflows/ci.yml`). Response and rotation
order: `SECURITY.md` → Exposure handling.

**The dev write endpoint reaching a build — the main one.** Protection and its
three assertions are in `SECURITY.md`, verified by
`tests/review-tool-is-dev-only.test.js`. Response: treat such a build as
compromised — rebuild, re-verify, diff `content/` against git.

**XSS.** React escapes by default; `grep -rn "dangerouslySetInnerHTML\|innerHTML"
web/src` is empty and must stay empty; no script `unsafe-inline` in the CSP.
Verified by that grep and the walk, where a console error is fatal. Response:
fix, then check whether stored content could carry the payload.

**Supply chain.** Lockfiles committed; the CSP blocks third-party origins, so a
compromised CDN is not a path in and a compromised npm package is. **No automated
scanning today.** Response: pin, patch, rebuild, re-run everything.

**Service-worker cache poisoning.** Same-origin only, the served `/sw.js` sent
`no-cache` (`web/public/_headers`), precache list generated at build
(`web/scripts/sw.mjs`). Response: new worker,
bump the cache name, confirm old caches are deleted.

**Content tampering via a pull request.** Content is generated and tests
recompute it from source (`tests/portal-summary.test.js`,
`tests/conjugation-against-corpus.test.js`). Response: revert, regenerate, diff.

**Clickjacking.** `frame-ancestors 'none'` and `X-Frame-Options: DENY`.

**Not applicable, by absence of the feature:** credential stuffing, session
theft, access-control bypass, cross-tenant access, SQL injection, CSRF, SSRF,
malicious upload, webhook replay. There is no credential, session, role, tenant,
database, form, outbound request, upload or webhook. **Each applies the day a
server is added** — read `AUTHENTICATION.md` first.

**Reading another profile on the same device is expected**, not a vulnerability
(`DATA.md`).

## Verification

`npm test` · `cd web && npm run build` (includes the first-load budget) ·
`node web/e2e/walk.mjs` (console errors fatal; covers blocked storage and private
windows). **After any header change**, serve `dist/` with `_headers` applied and
load every screen with the console fatal — the CSP was tightened by observing
what broke, not from a template. A passing build is not proof; `CHECKLIST.md`
records what has been seen to fail.

## If something happens

**Contain** (nothing is deployed, so usually "do not merge") → **rotate** any
possibly-exposed credential before disclosure → **preserve evidence**: keep the
commit, build output and logs, and do not force-push over the history you are
investigating → **recover** by rebuilding from a known-good commit, re-running
the suite and diffing `content/` against its generators → **write it down** in
`docs/lessons.md`, with the cause and not only the fix.
