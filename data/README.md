# Build inputs

Not shipped to learners. `content/` is what the application fetches; this
directory is what *produces* it. The service worker precaches `content/`, and
nothing here is in that list.

## `wiktionary-glosses.json` — 168 KiB

The output of `scripts/harvest_glosses.py`: two English senses per verb, the
register labels, the verbs whose English is unprintable, and the 51 that are
pronominal-only.

**This is committed so that `content/` can be rebuilt with no network access at
all.** It is the derived form, which is the one the build consumes:

```sh
python3 scripts/build-verbs.py \
  --lexique <Lexique383.tsv> \
  --glosses data/wiktionary-glosses.json
```

From en.wiktionary.org, CC BY-SA 4.0, redistributed under the same licence and
attributed in `content/attribution.json` and at `/about`.

## `verb-frequency-list.txt` — the 2,400 lemmas, in frequency order

Derived from Lexique 3.83 (`freqlemfilms2 + freqlemlivres`, verbs only). Also
committed so the harvest and the build agree on which verbs exist and in what
order, without 24.65 MiB of Lexique being present.

## The page caches, which are NOT committed

Two caches of raw wikitext live outside the repository, and **their loss has a
price that has to be stated rather than discovered**:

| cache | pages | on disk | rebuild cost |
|---|---|---|---|
| gloss pages (en.wiktionary) | 2,393 | 11 MiB | **2,393 requests, ~14 min** at the 0.34 s delay the scripts hold |
| conjugation pages (fr.wiktionary) | 2,400 | 182 MiB | **2,400 requests, ~14 min** |

A cache whose loss costs 2,393 requests against somebody else's servers is not
a cache, it is an undeclared dependency. It is declared here.

**You only need them to change a PARSER.** To rebuild `content/`, use
`wiktionary-glosses.json` above and make no requests at all. The caches matter
when `harvest_glosses.py` or `harvest_wiktionary.py` changes, because then every
page must be re-read — which happened twice on 2026-10-02 and would have been
28 minutes of someone else's bandwidth each time without them.

Point the scripts at a directory you keep:

```sh
python3 scripts/harvest_glosses.py \
  --verbs data/verb-frequency-list.txt \
  --cache ~/.cache/flw/wiktionary-glosses \
  --out data/wiktionary-glosses.json
```

Both scripts write one file per page and read it back before fetching, so an
interrupted harvest resumes and costs only what it had not already done.
`~/.cache` rather than a scratchpad, because a scratchpad is cleared between
sessions and that is how the first copy was nearly lost.
