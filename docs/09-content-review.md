# Reviewing content — how to sit a batch

**Last updated 2026-10-04.** Written when the tool was built; nobody has yet
sat a review, and `data/review-decisions.json` is empty.

## Why this exists

Drafting exercises takes minutes. **The review that makes them safe to teach is
the cost** — measured at six to ten minutes an item, 15–25 hours for 150. See
the lessons entry *"drafting is minutes; the review that makes it safe to teach
is the cost"*.

Until an item is reviewed it is marked unreviewed, and the learner is told so on
the paper page, while sitting it, and beside every explanation in the results.
**An exercise earns the removal of its marker; it does not start without one.**

## Running it

```sh
cd web && npx vite            # the dev server, and nothing else
open http://localhost:5199/__review
```

Note `localhost`, not `127.0.0.1`: Vite binds the hostname, which resolves to
IPv6 here, and `127.0.0.1` is refused.

Optional: `?batch=20` sets the batch size (20 by default) and `?by=Name` the
reviewer (defaults to Shahin Amani).

**The tool only runs under `vite` in development.** It is gated twice — the
plugin declares `apply: 'serve'` and `vite.config.ts` adds it only when
`command === 'serve'` — because a tool that accepts a POST and writes JSON into
`content/` must never reach a build. `tests/review-tool-is-dev-only.test.js`
asserts all of that, and that nothing under `web/src` can call the endpoint.

## The keys

| key | what |
|:--|:--|
| `A` | approve |
| `R` | reject — a reason is required, the tool will not accept it without one |
| `S` | skip — "not now". The item stays in the queue and nothing is written |
| `N` | jump to the note field |
| `C` | clear the decision recorded for this item, and stay on it |
| `←` `→` | move between items |
| `Esc` | leave the note field |

**`←` can change a decision you already made.** Returning to an item shows what
you recorded and the note you wrote; `A`, `R` or `S` overwrites it and `C`
removes it. This exists because pressing keys quickly for two hours means
mis-keying, and a mistaken `A` records an approval **with your name on it**
against an item you did not read — which is the forging fault arriving by
accident instead of by test.

Typing in the note field does not trigger the keys, `Esc` leaves it, and a
verdict key pressed after the last item does nothing.

## Reviewing one batch

```sh
open 'http://localhost:5199/__review?paper=tcf-b2-structure-2&batch=20'
```

**Name the paper.** Without `?paper=` the queue is every undecided item in the
file — 56 of them — and a batch of 20 serves the DELF papers while the batch you
were asked to read sits at the end.

## The rule each item rests on

Every drafted item names the single claim about French it depends on, shown at
the top of the item with any risk that claim carries.

**This exists because flagging is blind to confident error.** An item whose
writer was unsure carries a flag; an item whose writer was confidently wrong
carries nothing. `b1-agr-1` to `b1-agr-4` all rest on direct-versus-indirect
object: if that is the wrong way round, four items are wrong together and no
flag shows it.

So **rejecting an item offers every other item resting on the same rule
immediately** — they come next, not in three months, and the banner names any
that are outside the batch you are reviewing. One wrong rule costs one session.

Three rules in the 28 drafted items carry more than one item:

| items | rule |
|---:|:--|
| 4 | pronominal agreement — is the pronoun the direct object? |
| 3 | « on » for an unknown agent |
| 2 | negative word order, adverb before pronoun |

### Before a session

```sh
cd web && npx vite --port 5199 --strictPort &
node web/e2e/review-tool.mjs
```

27 checks, driven by a real keyboard in a real browser: every key, the note
field, the reason-required refusal, overwriting with `←`, clearing with `C`, and
the batch-done state. It restores the decisions file afterwards. **Run it before
sitting a session** — the tool was reported working once when the endpoints
answered curl and every key handler was unobserved.

**Flagged items come first.** Where the writer was unsure, the doubt is shown at
the top of the item in full, because that is where a reviewer's six minutes are
worth most.

## What happens to your decisions

Nothing, until you apply them.

```sh
python3 scripts/apply-review.py --dry-run   # say what would change
python3 scripts/apply-review.py             # apply
```

The tool writes `data/review-decisions.json` and **never touches the content**.
The applier is Python because `content/exam-papers.json` is written by a Python
serialiser: a Node round-trip would reformat all 2,400 lines and bury every
review in a diff nobody could read. Measured — two decisions change 14 lines,
and they are the 14 lines that changed.

`data/review-decisions.json` is **committed**, deliberately. Who approved what,
and when, is exactly the kind of record this project exists to be honest about.

### What the applier refuses

- a rejection with no reason;
- an approval of an item flagged `uncertain` with no note — the flag says the
  writer did not know, and an approval silent about it throws away the only
  record that there was a question;
- a decision naming an item that does not exist.

It refuses the whole run and writes nothing, rather than applying the good ones.

## What is not here

**No inline editing.** Batch one exists to find out what the notes actually look
like. If they are mostly "change this one word", editing earns the extra three
and a half hours and gets built for batch two. If they are mostly "this case is
contested, drop it", editing would have been wasted.

**No Arabic.** Every item carries an Arabic slot, present and empty. It is not
machine-filled and will not be. The tool shows which languages an explanation is
missing, so the backlog is visible while you review.
