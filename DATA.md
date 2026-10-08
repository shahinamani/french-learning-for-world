# Data

## What is held, and where

Everything is in the visitor's browser. **Nothing is sent anywhere**: no server,
no analytics, no error reporting, no third-party origin (CSP `connect-src
'self'`).

- **public** — verbs, concepts, exam papers, flashcards (`content/*.json`),
  openly licensed and shipped in the build.
- **personal, local** — review log, card schedules, exam attempts, settings,
  profile names: IndexedDB `reviews`/`cards`, and `localStorage`.
- **never collected** — credentials, payment, contact details, location.

**Minimisation is the design.** A profile is a typed name and an opaque id
(`newId()`) — no email, no fingerprint, no identifier following anyone between
devices. **Do not add one.**

**Encryption.** HTTPS with HSTS in transit; at rest, whatever the browser
provides — this project adds none and must not pretend to.

**Access boundaries.** `flw:u:<id>:` prefixes separate learners *within* the app
and do not defend against the device's owner: the device is the trust boundary,
and **nothing confidential may be stored per profile.**

**Retention, backup, restore.** No server backup exists or can. A record lasts as
long as the browser's storage, and clearing site data destroys it irrecoverably
— the product says so before there is anything to lose
(`web/src/components/DataNotice.tsx`). Export/import on `/account` is the only
recovery path. **Restore is tested as a real round trip** — study, export, erase,
import, rows return (`web/e2e/walk.mjs`); an untested backup is not a backup. Not
covered: `parseExport` against malformed input (`CHECKLIST.md`). `eraseUser()`
deletes one learner's rows and clears the started flag.

## Audit events

No authentication exists, so **there is no authentication audit log today.** When
one is added:

**Record per event:** actor (an id, never a user-typed name), target, tenant
where tenants exist, UTC timestamp, outcome, a **safe reason code** from a fixed
enumeration (`BAD_CREDENTIAL`, `RATE_LIMITED`, `MFA_REQUIRED` — never a message
revealing whether an account exists), a correlation id, and network metadata only
where justified and documented.

**Never record** — in any log, fixture, screenshot, bug report or test —
passwords, bearer tokens, session cookies, MFA seeds or codes, recovery codes,
API secrets, invitation or reset tokens, or full request bodies. Redaction after
the fact is not a control: do not pass them to the logger.

**Storage.** One append-only store outside the web root, readable only by the
service account writing it and the operator reviewing it; path and retention go
in `CHECKLIST.md` once it exists. Proposed retention 180 days.

**Failure handling.** A failed audit write must not silently succeed: for a
security-relevant action, failing to record it fails the action.

**Bounded growth.** Rotate by size and age; index what is queried. **No unbounded
full-request logging** — the fastest way to put a token in a log file. Existing
queries read a bounded window (`web/src/lib/progress.ts`).

## In force today

Fixtures hold corpus data, not people (`tests/fixtures/`). Screenshots go to a
temporary directory and are never committed. No email address may appear in a
tracked file — enforced by the pre-push sweep and a CI step, though the local
sweep catches a regex-escaped address and **the CI copy does not yet**
(`CHECKLIST.md`).
