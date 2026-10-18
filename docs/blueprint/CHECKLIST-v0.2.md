# Blueprint v0.2 — the one shared implementation checklist

Source of truth: `French-Portal-Blueprint-FA.pdf`, v0.2, 16 October 2026,
learner-only scope. Twenty pages, read in full on 18 October 2026.

This file is the coordination contract. Every row names a requirement, who
owns it, where it is implemented, how it is verified, and its honest status.
**A row is DONE only when its verification has been run and is named.** Green
CI is not a status; neither is "implemented".

Status values: `TODO` · `IN PROGRESS` · `DONE` (with evidence) ·
`BLOCKED` (with the exact missing input) · `OUT OF SCOPE v0.2` (quoting the
blueprint).

---

## 0. What the blueprint says about itself, and what that changes

Three sentences in the document govern everything below and are quoted here so
nobody has to re-read 20 pages to find them.

- §20: **«تحویل نهایی باید یک URL قابل استفاده با نسخه‌ٔ معلوم باشد؛ لینک
  preview که فردا کار می‌افتد production محسوب نمی‌شود.»** A preview link is
  explicitly *not* production.
- Appendix §3: publication requires a test environment separate from
  production, the exact version and CI results named, **secrets entering via
  tooling and never committed**, and — where server data or migration exists —
  a retrievable backup and a *tested* rollback that does not wipe new progress.
- Appendix closing line: **«این سند مجوز اجرا نیست.»** — the document states
  it is not itself an execution permit.

The owner's brief authorises execution and release *"within the blueprint's
scope and existing access permissions"*. The blueprint's own publication gate
is therefore the standard, and **existing access permissions are the binding
constraint** — see the blockers in §B.

---

## A. Streams and file ownership

The blueprint §20 defines four parallel streams. They are kept, with explicit
file ownership so two workers never hold one file.

| Stream | Owns (files) | Must not touch |
|:--|:--|:--|
| S1 Design & shell | `design-system/tokens.css`, `design-system/components.css`, `web/src/styles.css`, `web/src/components/Shell.tsx`, routing table in `web/src/main.tsx` | content JSON, scheduler |
| S2 Learning tools | `web/src/features/**` (card, verb, exercise, Player, Reader) | tokens, content JSON |
| S3 Content & translation | `content/**`, `docs/blueprint/content-*.md` | any `web/src/**` |
| S4 Storage & integration | `web/src/lib/db.ts`, `scheduler.ts`, `session.ts`, sync/migration, `web/e2e/**`, CI | feature components |

Shared contracts that must exist **before** any stream expands (§20: «قرارداد
مشترک کامپوننت‌ها پیش از گسترش»):

| Contract | File | Status |
|:--|:--|:--|
| Content model (id, type, level, topic, goal, skill, version, translations, media, source, licence, review status, relations) | `docs/blueprint/contract-content.md` | TODO |
| Progress event schema (ReviewEvent, SavedItem, ReadingPosition, PlaybackPosition, Note) | `docs/blueprint/contract-progress.md` | TODO |
| Component contract (§16 table) | `docs/blueprint/contract-components.md` | TODO |
| Route + navigation map (§5) | `docs/blueprint/contract-routes.md` | TODO |

---

## B. Blockers — named now, not at the end

The brief says to identify genuine blockers early. These four are not
schedule risk; they are missing inputs that no amount of implementation
removes.

| # | Blocker | Blueprint requirement it blocks | Exact missing input |
|:--|:--|:--|:--|
| B1 | **No deployment credentials and no domain control.** `wrangler` is not installed, there are no Cloudflare environment variables on this machine, and DNS for `frenchmavie.com` sits at Namecheap. | §20 live URL with a known version; Appendix §3 HTTPS on the real domain, separate test environment, secrets via tooling | A Cloudflare API token (or chosen host) **and** confirmation of who changes DNS. Until then "production" cannot exist and I will not claim it does. |
| B2 | **No licensed media.** The blueprint forbids embedding external text/audio/image without right of use (§11, §18) and requires a maintained source process with owner, licence and review date. The repository has no licensed recording — this is a standing, pre-existing item, not new. | §12 podcast catalogue and episode pages; §18 sample package "6 audio files including dialogue and mini-podcast"; §11 2 permitted news items | Either licensed sources (names + permission evidence), or a decision to ship device speech **clearly labelled as device speech**, which §12 permits for exercises but which cannot stand in for a podcast catalogue. |
| B3 | **Account and sync need a backend that does not exist.** | §19 optional account; Appendix §1 path "guest → account → second device"; §21 acceptance row «حساب» (guest transfer, two devices, exit without data leak) | A decision: (a) ship v0.2 **guest-only**, with the UI making no account promise — which §19 explicitly allows and arguably prefers — or (b) authorise a backend, which brings hosting, secrets, backup and rollback with it. |
| B4 | **Human content review.** §18 requires a real reviewer to confirm educational and linguistic quality; §21 makes content quality an acceptance row. 0 of 76 exam items and 0 of 32 enriched cards have a teacher record. | §21 «کیفیت محتوا» | A French teacher's reading, and a Persian reader's. I can draft and mark; I cannot review, and will not mark anything reviewed. |

**B3 has a default I will take unless told otherwise:** ship guest-only and
make the UI promise nothing it cannot do, per §19's own wording. That keeps
the acceptance row honest rather than faked, and it is reversible.

---

## C. Requirement → implementation → verification

### §5 Page architecture (14 routes)

| Route | Blueprint name | Implementation | Verification | Status |
|:--|:--|:--|:--|:--|
| `/app/today` | امروز من | new | journey 1–5 entry; §7 modules each with data+action+empty state | TODO |
| `/app/path` | مسیر من | new | goal change, units, next step | TODO |
| `/app/vocabulary` | واژگان | adapt existing | §8 library standard | TODO |
| `/app/cards` | فلش‌کارت | exists (`/workspace` flashcards) — port | §9 full | TODO |
| `/app/verbs` | فعل و زمان‌ها | exists (`/learn/verbs`) — port + compare tab | §10 | TODO |
| `/app/grammar` | گرامر | adapt `/learn/concept/:id` | §10 grammar loop | TODO |
| `/app/listening` | شنیدن | **stub today** | §12 | TODO (B2) |
| `/app/reading` | خواندن | new Reader | §11 | TODO |
| `/app/output` | گفتن و نوشتن | new | §13 | TODO |
| `/app/news` | خبرها | new | §11 + B2 | TODO (B2) |
| `/app/podcasts` | پادکست‌ها | new | §12 + B2 | TODO (B2) |
| `/app/exams` | آزمون‌ها | exists (`/practise/exams`) — port | §14 | TODO |
| `/app/saved` | کتابخانهٔ من | new | §8 | TODO |
| `/app/progress` | پیشرفت و ضعف‌ها | exists — extend with §15 weaknesses | §15 | TODO |

Old routes must redirect, not 404 — Appendix §1 "direct link and refresh
preserve the path".

### §17 The five journeys — the real acceptance test

| # | Journey | Ends with | Verification | Status |
|:--|:--|:--|:--|:--|
| J1 | خبر → واژه → کارت → مرور → بازگشت | phrase with its source sentence and review history | E2E, real data, survives reload | TODO (B2 for the news half) |
| J2 | جست‌وجوی «گذشته» → مقایسهٔ زمان‌ها → تمرین → توضیح خطا → تمرین مجدد | result + related review suggestion | E2E | TODO |
| J3 | پادکست → فیلتر → پخش → تکرار جمله → ذخیرهٔ واژه → خروج و بازگشت | second pause, playlist, words | E2E | TODO (B2) |
| J4 | انتخاب نسخه → تمرین مهارتی → نتیجه → تمرین جبرانی → بررسی بعدی | understandable per-skill history | E2E | TODO |
| J5 | زبان‌آموز عربی/ترکی: زبان رابط و معنی → فعالیت → تغییر تم → ذخیره → ورود دوباره | preferences and progress preserved, French text healthy | E2E incl. RTL | PARTIAL — RTL and theme already verified; Turkish interface does not exist |

**Turkish is a gap:** §4 lists Türkçe as an interface language and J5 names a
Turkish learner. The product has en/fr/fa/ar only. Adding `tr` means a fifth
dictionary; by the project's standing rule I may draft it but it would be
unreviewed. Recorded, not silently dropped.

### §21 Quality gate — acceptance rows

| Row | Verification | Status |
|:--|:--|:--|
| ورود از لندینگ | guest reaches a working sample without a long form | TODO |
| پیدا کردن کار | ≤2 actions from home to vocab/listening/news list | TODO |
| کارت غنی | meaning, tense examples, audio, translation, save, next review all work | PARTIAL — 32/2371 cards enriched |
| اتصال داده | word from news appears in cards with source sentence, survives reload | TODO (B2) |
| Reader | meaning panel, translation, return to position | TODO |
| Player | play, speed, repeat, text, resume after return | TODO (B2) |
| فعل و گرامر | past/future choice direct, practice with reason | PARTIAL |
| ضعف‌ها | every suggestion has evidence and a practice link; thin data labelled | TODO |
| آزمون | known version, clear rules, result and real coverage | PARTIAL — 6 papers, 76 items, structures verified |
| زبان و تم | fa/ar RTL, tr LTR, theme change does not erase progress | PARTIAL — tr missing |
| موبایل و دسترس‌پذیری | 360px + desktop, focus, keyboard, font, reduced motion | PARTIAL — axe green en/fa/ar |
| خطا و آفلاین | deleted file, network cut, empty result, no audio each have a path | PARTIAL |
| حساب | guest transfer, two devices, exit without leak | BLOCKED (B3) |
| کیفیت محتوا | correct answers, synonymous translation, audio matches text, clear licence | BLOCKED (B4) |
| انتشار | main paths run on the published version, not only local | BLOCKED (B1) |

### §18 Vertical sample package — the minimum connection test

| Item | Target | Have | Status |
|:--|:--|:--|:--|
| Enriched cards | 30 | 32 | DONE |
| Verb/grammar lessons | 6 | 0 as lessons | TODO |
| Texts | 4 | 0 | TODO |
| Permitted news items | 2 | 0 | BLOCKED (B2) |
| Audio incl. dialogue + mini-podcast | 6 | 0 licensed | BLOCKED (B2) |
| Speaking/writing scenarios | 2 | 0 | TODO |
| Exam practice set | 1 defined | 6 papers exist | PARTIAL |

The blueprint is explicit that this package is **the minimum connection test,
not a sales criterion**, and that no section may be promised with an empty
sample.

---

## D. What is preserved, not rebuilt

The brief and §19 agree: *"rebuild from scratch" does not authorise deleting
data or replacing working foundations.* Preserved:

- FSRS scheduler and every `ReviewEvent` / card state in IndexedDB. Card keys
  are stable identities; enrichment attaches to them and never renames them.
- React + Vite build, the 150 KB budget, the service worker.
- The four-language dictionary and its optional-group mechanism.
- The guard suite: attribution scan, pre-push sweep, axe in en/fa/ar, contrast,
  the corpus content tests.
- Existing content: 2,371 eligible cards, 76 exam items, 261 concepts, 2,387
  verbs with paradigms.

---

## D2. Integration risks being tracked

| Risk | Evidence | What happens if ignored |
|:--|:--|:--|
| **The 150 KB first-load budget is tightening.** `main` was 134.3 KB before this work, is 137.4 KB after six merges, and the portal shell takes it to 140.0 KB — **10.0 KB spare** with the Reader and the grammar loop still to land. | the figure the build prints on every run | The build fails, and the project's one never-slipped discipline slips. Mitigation: every remaining feature is a lazy chunk, and anything that cannot be is reported before it merges rather than after. |
| **Several streams append to `web/src/lib/i18n.ts` and to the same three test files.** | four optional groups added so far: `shellEn`, `readerEn`, `grammarEn`, `weaknessEn` | Rebase conflicts. Mechanical to resolve — keep both groups — but they must not be resolved by dropping one. |
| **`scripts/preview.sh` kills whatever holds its port.** Two streams killed each other's preview server mid-run, and one mutant verification had to be discarded and redone. | reported independently by three streams | Invalid test runs that look like real ones. Fixed by assigning each stream a distinct `PORT`; the script itself should probably refuse a port it did not start. |
| **Hardcoded old links remain in `features/**`, `Learn.tsx`, `Search.tsx`, `Stub.tsx`.** | shell stream's report | They work today only because the redirects catch them. Each owner rewrites their own. |

## E. Honest state at the time of writing

`main` = `e0af679`. Routes are `/learn`, `/practise/*`, `/workspace` — the
`/app/*` architecture does not exist yet. 32 of 2,371 cards enriched, 0
teacher-reviewed. One dialogue unit. Listening is a stub. No production
deployment exists and none has ever existed.

The blueprint's own §22 says the previous problem was *"the main experience
not being complete at delivery"* — so this checklist exists to make
incompleteness visible while it is still fixable, rather than at the end.
