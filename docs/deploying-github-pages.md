# Deploying to GitHub Pages (prepared, not executed)

**Status 2026-10-19: nothing here has been run, enabled or published.** Pages is
not enabled on the repository, `.github/workflows/deploy-pages.yml` has never
run, and no Cloudflare resource exists. This page is the evidence for a choice
of host; the choice is the owner's. It sits beside `docs/deploying.md`, which
records the Cloudflare plan and remains the plan of record until that choice is
made.

## What GitHub Pages does to the headers

`web/public/_headers` is a Cloudflare Pages file. GitHub Pages does not read it
and offers no way to set response headers at all. What a visitor gets instead was
checked, not assumed, on 2026-10-19: one `HEAD` request each to three public
Pages sites (`pages.github.com`, and two `*.github.io` project sites), and
GitHub's published behaviour for the rest. Sample size is small, so "observed"
below means "seen in those responses".

| Header in `_headers` | GitHub Pages sends it? | Can a `<meta>` replace it? | Verdict |
|---|---|---|---|
| `Content-Security-Policy` (12 of 13 directives) | No. Not on content pages | **Yes**, `<meta http-equiv>` | **Replicated**, see the caveats below |
| `frame-ancestors 'none'` (inside the CSP) | No | **No. Ignored in a `<meta>` CSP** | **Lost** |
| `report-uri` | Not used by this project by design | Ignored in `<meta>` | Not applicable: there is no reporting, on either host |
| `Strict-Transport-Security` | **Inconsistent.** One sample sent `max-age=31556952`, another sent none. No `includeSubDomains`, no `preload`. Not configurable | No. Browsers ignore HSTS in a `<meta>` | **Lost as our control.** HTTPS is still enforced, by a different mechanism, below |
| `X-Content-Type-Options: nosniff` | No (absent in all samples) | No | **Lost** |
| `Referrer-Policy` | No | **Yes**, `<meta name="referrer">` | **Replicated** (and it equals the modern browser default) |
| `Permissions-Policy` | No | No `<meta>` form exists | **Lost** |
| `Cross-Origin-Opener-Policy` | No | No | **Lost** |
| `Cross-Origin-Resource-Policy` | No. It sends `Access-Control-Allow-Origin: *` on everything | No | **Lost** (and contradicted, though all content is public) |
| `X-Frame-Options: DENY` | No | No | **Lost** |
| `Cache-Control` for `/assets/*`, `/fonts/*` (immutable) | No. Sends `max-age=600` on everything | No | **Lost.** Hashed files revalidate every 10 minutes instead of never; a cost in requests, not a safety fault |
| `Cache-Control: no-cache` for `/sw.js`, `/index.html` | No. `max-age=600` | No | **Weakened.** `index.html` can be up to 10 minutes stale. The service worker script is fetched past the HTTP cache by default when the browser checks for updates, so updates should not wait ten minutes (browser behaviour, not tested on a live Pages site) |
| `_redirects` catch-all (not a header) | Ignored | n/a | Moot: the router is hash-based. A mistyped path gets GitHub's 404 page, not the app's |

### HTTPS is not the HSTS question

`github.io` was **not** found on the browser HSTS preload list. Checked on
2026-10-19 against Chromium's `transport_security_state_static.json` (95,147
entries; no `github.io`, no `io`) and against `hstspreload.org`
(`status: unknown`). `github.com` is on it; `github.io` is not. An earlier
assumption in this task that it was preloaded is therefore **wrong**.

What enforces HTTPS on `*.github.io` is the repository setting **Enforce HTTPS**,
which makes GitHub answer plain `http://` with a `301` to `https://` (seen on a
sample site). That redirect is real, but it is sent over HTTP, so a first visit
typed or linked as `http://` can be intercepted before the redirect. HSTS (when
GitHub sends it, and it was not sent on every sample) closes that window only
after a first successful HTTPS visit. On Cloudflare with our `_headers`, the
header is present on every response, and the `preload` submission remains the
owner's separate decision.

### The mitigation that is real, and what it leaves

`web/scripts/meta-csp.mjs` runs only when `FLW_META_CSP=1` (the Pages workflow
sets it; nothing else does, so the Cloudflare, local and CI builds are
unchanged). It copies the policy out of `_headers`, so there is one policy and
not two, and writes two tags first in `<head>`:

- `<meta http-equiv="Content-Security-Policy">` with 12 of the 13 directives.
  `frame-ancestors` is **removed rather than left in**: it is ignored there, logs
  a console error, and reads like a working control.
- `<meta name="referrer">` with the same value as the header.

Tested on the real build served under the sub-path with **no headers at all**:
an injected inline script was blocked, a `fetch` to another origin was blocked,
and the walk below ran under it.

Caveats that stay true:

- A `<meta>` CSP governs only what is parsed after it, so it is first in `<head>`.
  It protects the HTML document, not the headers on `sw.js`, the JSON files or
  the fonts.
- **Not mitigated, and not claimed to be:** framing (clickjacking), MIME
  sniffing, feature lock-down (`Permissions-Policy`), cross-origin isolation
  (COOP/CORP), a guaranteed HSTS header, and immutable caching. A frame-busting
  script was considered and **not** added: it is bypassable (a sandboxed
  iframe disables it) and would be described as a control it is not.
- **Practical weight of the losses is low for this product** and should be
  stated that way, not larger and not smaller. There is no account, session,
  server or cross-origin request. The realistic framing attack is tricking a
  learner into pressing a destructive button (erase or import) on a framed copy
  of the Account screen; it needs a malicious page and a confirm the learner
  does not read.

### One difference that is not a header: the origin is shared

On `<user>.github.io` every project site of that user is the **same origin**.
`localStorage`, `sessionStorage` and IndexedDB, where all the learner data
lives (`flw:u:<id>:` keys, `fmv.started`), are shared by every Pages site that
account ever publishes. A second Pages site there could read and overwrite this
one's data. Service-worker scope is path-limited and does not protect storage.
At the time of writing the owner's public repositories had no other Pages site
(private repositories were not checked). A dedicated domain, as on Cloudflare,
removes the question. This is the largest real difference between the two
targets, and no `<meta>` addresses it.

## The base path (nothing to change, and why)

A project site is served from `/french-learning-for-world/`. `web/vite.config.ts`
already sets `base: './'`, every `fetch` in `web/src` is relative, the service
worker registers as `./sw.js`, and the router is a hash router. So the build is
location-independent and **no `base` change, environment variable or second
build was introduced**. Verified, not assumed:

- Default build served at a domain root: 603 checks, 0 failed, 0 console errors.
- The same build served under `/french-learning-for-world/`: 603 / 0 / 0.
- A request audit under the prefix: 80 requests, none above 399, none outside the
  prefix, service worker active with scope `.../french-learning-for-world/`, 44
  files in its cache, and a reload with the network off still rendered the app.

**One thing did break, and is fixed:** the build-time prerender wrote
root-absolute links (`href="/learn"`, `/app/today`, `/account`, ...) into
`index.html`, because the server-rendering router writes paths while the app
uses hash addresses. At a domain root that was harmless. Under a sub-path those
links leave `/french-learning-for-world/` and hit the host's 404, for anyone
with JavaScript off, a crawler, or a slow first paint. The browser walk could not
see it (it waits for the bundle, which replaces the markup). `prerender.mjs` now
writes `#/learn` and **fails the build** if any root-absolute `href` or `src`
remains.

The manifest: the Vite app ships none (`manifest.webmanifest` at the repository
root belongs to the older portal and is not in `web/dist`). Nothing to break.

### A finding that predates this work and is not host-specific

Under the CSP, opening a Radix dialog (the side panel) logs `Refused to apply
inline style ... style-src 'self'`. Radix's scroll-lock injects a `<style>`
element. The same directive is in `_headers`, so the Cloudflare plan should have
the same fault (inferred; the walk has not been run against a server sending the
real headers). It was never seen because CI serves the build with no CSP at all.
Consequence: the page
behind a dialog may scroll while it is open, and the console is not clean. It is
**not fixed here**: the options (a hash in `style-src`, which changes with the
measured scrollbar width; `unsafe-inline` for styles; or replacing the scroll
lock) widen the policy or change behaviour, and that is a decision, not a
side-effect. With the meta CSP the walk reports 603 checks, 0 failed, 8 console
errors, all the same violation (one `sha256` each time), logged against eight
different sections of the walk.

The walk's three `addScriptTag` calls that injected axe were changed to
`evaluate`, because an injected `<script>` element is refused by any CSP and
that made the walk unusable under one. The scan is the same code, run the same
way.

## Running it (when the owner decides)

1. Settings > Pages > Source: **GitHub Actions**. Nothing in the workflow can do
   this, by design.
2. Actions > "Deploy to GitHub Pages (manual)" > Run workflow. Leave `ref` empty
   for the tip of `main`.
3. The run refuses a commit that is not reachable from `main`, builds with
   `FLW_META_CSP=1`, checks the output (meta CSP present, no root-absolute URL,
   no review-tool strings), deletes `_headers` and `_redirects` from the artefact,
   writes `build-info.json`, and deploys.
4. The version is on the live site at `<site>/build-info.json` (commit, time, run
   id) and in the run summary.

**Rollback:** re-run the workflow with `ref` set to the previous good commit
(its SHA is in the earlier run's summary). Nothing else to undo; the site is the
artefact of one commit. The service worker keeps serving a learner's cached copy
until the new worker installs, so a rollback reaches a returning learner on the
visit after the next one.

The Pages actions are pinned by major tag (`@v5`, `@v6`), like the other
workflows here, not by commit SHA. They were the latest releases on 2026-10-19
and, like the workflow, have not run.

## Cloudflare Pages: what is needed, and where it goes

If Cloudflare is chosen, nothing in this repository has to change: `_headers`
and `_redirects` are already in `web/public`.

- **Dashboard route (the plan of record):** connect the repository in the
  Cloudflare dashboard, build command `npm ci && npm run build` in `web/`,
  output `web/dist`. This needs **no API token**; the repository link is a GitHub
  app authorisation granted in the browser.
- **Deploy-from-Actions route (only if wanted instead):** an API token with the
  single permission **Account > Cloudflare Pages > Edit**, scoped to the one
  account, with no zone, user or DNS permission, and an expiry date. Also the
  account id. (Permission name from Cloudflare's published permission list; not
  verified against a live account, since none exists.) DNS stays at Namecheap, so
  no DNS permission is needed or wanted.
- **Where the token goes:** GitHub repository secrets
  (**Settings > Secrets and variables > Actions > New repository secret**, names
  `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) and nowhere else: not a chat
  message, not an issue, not a committed file, not a log. A token that appears in
  any of those is compromised and is rotated before anything else
  (`SECURITY.md` > Exposure handling). Nothing has been created on Cloudflare, and
  no workflow for this route is committed.

## What is lost versus Cloudflare, in one list

Framing protection, `nosniff`, `Permissions-Policy`, COOP, CORP, a reliable
HSTS header, immutable asset caching, the `_redirects` catch-all, and storage
isolation from other sites on the same `github.io` origin. Kept: the CSP (minus
`frame-ancestors`) and the referrer policy. Gained: no third party, no token, no
DNS work, a working site at a stable URL in one step.
