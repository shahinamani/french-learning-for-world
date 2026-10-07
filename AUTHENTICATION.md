# Authentication

## Today: none

No login, password, account, session token, MFA or server. A "user" is a local
**profile** (`web/src/lib/session.ts`): a typed name and an opaque id, with no
credential and nothing to authenticate against.

Profiles give: active profile per **tab** (`sessionStorage`), last-used per
browser, every key namespaced `flw:u:<id>:` via `userKey()`, no mutable
module-level "current user", and two tabs with two profiles asserted not to bleed
(`web/e2e/walk.mjs`). **A profile is not an identity** — unauthenticated and
editable by anyone holding the device; nothing may be gated on it.

**Every value below is PROPOSED, not enforced.** Nothing here rate-limits, locks
out or expires anything; no document may be read as saying otherwise.

## Mandatory, from the day a server exists

**Sessions.** Rotate the identifier on every authentication and privilege change.
Separate **idle** and **absolute** expiry, both server-side — a client timer is a
convenience, never the enforcement. Revocation is server-side and immediate on
verified compromise, suspension, password or MFA change, or "sign out
everywhere".

**Cookies and tokens.** `HttpOnly`, `Secure`, `SameSite=Lax` minimum, host-only,
`__Host-` prefix where the path allows. Never in a URL, `postMessage`,
`localStorage` or anything logged. CSRF: `SameSite` plus a per-session token on
state-changing requests. `form-action 'none'` in `web/public/_headers` must be
relaxed deliberately, with the reason recorded, if forms arrive.

**MFA** required for any privileged role — notably anything that approves content
or writes to `content/` — before that role exists. Recovery codes: single-use,
hashed, shown once. An invitation binds **server-side** to the identity that
accepted it; never trust a client-supplied identifier.

**Rate limiting** is configurable, per-account **and** per-IP as separate
counters, with progressive delay and a temporary cooldown, values in
configuration rather than code.

- **No permanent bans.** A cooldown expires by itself.
- **A legitimate session is never ended because someone else guessed wrong at
  that account.** Failures throttle *attempts*; they sign nobody out. The most
  commonly botched rule here, which is why it is written down.
- **Throttle the attempt, not the person**, and say so without revealing whether
  the account exists.

**Abuse signals combine; none suffices alone.** An IP change, a shared IP, a
datacentre range or a bot score is **not** proof — households and mobile networks
share addresses, and a VPN is not an attack. Require several independent signals
(failure rate, stuffing patterns across accounts, impossible travel against a
known-good baseline, automation fingerprints), and prefer a challenge to a block.

**Client IP.** Trust `X-Forwarded-For` / `CF-Connecting-IP` **only** from the
configured proxy, and only the hop it appended. An untrusted header is user input.

**Challenges** are adaptive — on suspicion, not every attempt — with a non-visual
alternative and a documented route to human help.

**Proposed starting values**, to be set in configuration and then recorded in
`CHECKLIST.md` with evidence: 5 per-account failures before progressive delay ·
15-minute self-expiring cooldown · 20 per-IP failures across accounts in 10
minutes as a stuffing signal · 14-day idle and 90-day absolute session expiry ·
MFA required for privileged roles. **None is in force.**
