# Security policy

## Reporting a vulnerability

Please report security issues privately through GitHub's
[private vulnerability reporting](https://docs.github.com/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability)
on this repository, rather than opening a public issue.

Please include what you found, how to reproduce it, and what an attacker could
do with it. You will get an acknowledgement, and credit in the fix unless you
prefer otherwise.

## Secrets

This repository is public. **No credential, key, token, password, connection
string, private hostname or personal datum may ever be committed** — see
[CONTRIBUTING.md](CONTRIBUTING.md).

**This project holds no secrets today.** No server, no API key, no database, no
third-party account; `grep -rn 'import.meta.env\|process.env' web/src` returns
nothing, and there is no `.env.example` because there is nothing to place in it.
(An earlier version of this paragraph described one that has never existed.)

**When a secret first appears**: injected at runtime by the host (Cloudflare
Pages environment variables), never committed; only a placeholder
`.env.example`. A public client identifier the browser necessarily receives is
not a secret; anything that authenticates **as** this project is.

Two hooks in `.githooks/` enforce this: **pre-commit** scans staged changes for
credential patterns, and **pre-push** runs the full sweep — credentials, commit
attribution, personal data and the unit tests — before anything leaves the
machine. Enable both once per clone:

```bash
./scripts/setup-hooks.sh
```

Hooks are never cloned with a repository, so this must be run once in every
clone — otherwise the scanner is present but never runs.

If you believe a secret has been committed, **do not open a public issue** —
report it privately as above so the credential can be rotated first.

## Boundaries, roles and authorization

**No server, no accounts, no privileged role.** Everything runs in the visitor's
browser against static files; `docs/deploying.md` records that nothing has ever
been deployed. There is no server-side authorization to get wrong — and none to
rely on: **nothing this application renders is access control.**

`web/public/_headers`, verified against a real build: CSP `default-src 'none'`
with every directive `'self'`; `frame-ancestors 'none'` plus `X-Frame-Options:
DENY`; HSTS with `preload` **not submitted** (Shahin's decision alone);
`Permissions-Policy` denying camera, microphone, geolocation and twenty more.
Profile isolation: `web/src/lib/session.ts`, per-tab `sessionStorage`, keys
prefixed `flw:u:<id>:`. The only write endpoint is the dev-only
`web/vite-plugins/review.mjs`.

**Profiles are the tenant analogue; isolation is real but local.** The walk
drives two tabs with two profiles and asserts they do not bleed — but it is **no
boundary against the device's owner**, so nothing confidential may be stored per
profile.

**The review tool is the highest-risk component here**: a POST that writes JSON
into `content/` — a review screen in development, an unauthenticated file writer
anywhere a stranger can load it. `tests/review-tool-is-dev-only.test.js` asserts
three independent guarantees. **Any change giving the application a write path
repeats this analysis first.**

**Least privilege:** CI is `permissions: contents: read` with no token that can
write; nothing cross-origin loads, and adding a CSP origin is a deliberate,
explained change; **no `console.log` of profile contents, review rows or
answers** may ship — the walk treats a console error as fatal.

## Exposure handling

A secret reaching this repository is **compromised from the moment it is
pushed**, and deleting the string is not a fix — GitHub keeps `refs/pull/*`
permanently, so even a rewrite leaves it reachable. Order: **revoke and rotate
first**, then clean history, then report privately.

## Dependencies

Few by design: React, react-router, `ts-fsrs`, `idb`, Radix. The CSP blocks code
from anywhere but `'self'`, so a compromised CDN is not a path in; a compromised
npm package still is. **Justify a new dependency before adding it.** There is no
automated dependency scanning today — see `CHECKLIST.md`.

Before changing storage, the service worker, the headers, the review tool, or
anything that introduces a server: read `AUTHENTICATION.md`, `DATA.md`,
`HACK.md`, `CHECKLIST.md`.
