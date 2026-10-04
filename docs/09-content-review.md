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
| `←` | back one item |
| `Esc` | leave the note field |

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
