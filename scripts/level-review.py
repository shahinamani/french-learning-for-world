#!/usr/bin/env python3
"""Build the level-assignment review sheets.

**Levels are assigned from raw frequency, and raw frequency is not teaching.**
`paumer` sits at C1 because it is the 1,402nd most frequent verb in French. A C1
learner is reading literature and writing argumentative essays; « paumer » is
"to lose" in the register you use with friends. Its frequency is right and its
level is meaningless.

This script does not fix that — a teacher does. What it does is find the verbs
where there is EVIDENCE the frequency is lying, so the review is 250 rows
instead of 2,392.

Three independent signals:

1. **Register, read from the gloss labels.** A verb marked (slang),
   (colloquial), (informal) or (vulgar) is not a level, it is a register, and
   the two are different axes. There is no `register` field in the content —
   the label survives only as text inside an English sentence — so the level
   ladder has nowhere to say "teach this for comprehension, not production".
2. **Spoken against written frequency.** Lexique carries `freqlemfilms2`
   (subtitles) and `freqlemlivres` (books) separately, and the build uses their
   SUM, which destroys the distinction. « bosser » is the 247th most frequent
   verb in film subtitles and the 1,223rd in books — a gap of 976 — and it is
   filed at A2 on the strength of the spoken half. « songer » is the reverse:
   219th in books, 569th in films, and filed at A2 where it is a literary verb.
3. **Pronominal-only.** « s'esclaffer » needs the reflexive construction before
   it can be used at all, so it is harder than its frequency implies.

Output is two sheets in docs/reviews/, each with a column for the ruling.
"""
from __future__ import annotations

import argparse
import csv
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
BANDS = [("A1", 1, 200), ("A2", 201, 500), ("B1", 501, 900),
         ("B2", 901, 1400), ("C1", 1401, 1900), ("C2", 1901, 2400)]

# Registers as the glosses carry them. Spoken/low registers and
# written/high registers are flagged for different reasons.
LOW = ("slang", "colloquial", "informal", "familiar", "vulgar", "childish")
HIGH = ("literary", "archaic", "dated", "formal", "poetic")
# The RATIO of the two ranks, not their difference. A 300-rank gap is noise at
# rank 2,000 and enormous at rank 200; the first version of this script used a
# flat difference and flagged 1,414 verbs of 2,392, which is not a review sheet.
# The ratio's median is 1.42 and its 95th percentile 2.84, so 2.5 selects the
# tail rather than describing the middle.
SKEW_RATIO = 2.5


def band(rank: int) -> str:
    return next(lvl for lvl, a, b in BANDS if a <= rank <= b)


def sense_registers(gloss: str) -> tuple[list[str], list[str]]:
    """Register labels on the FIRST sense, and on any sense.

    The distinction matters more than it looks. « chercher » is correctly A1 and
    carries (slang) — on its third sense, "to mess with someone, ask for
    trouble". Flagging the verb for that is noise, and the first version of this
    script filled a third of tier one with it: « vouloir », « arriver »,
    « entendre », « sentir », all flagged for a label on a sense a beginner will
    never meet.

    A label on the LEADING sense is a statement about the verb. A label further
    down is a statement about one of its uses.
    """
    senses = [x.strip() for x in gloss.split("; ")] or [""]
    def found(text, pool):
        return [w for w in pool if re.search(r"\(" + w + r"\)", text, re.I)]
    first = found(senses[0], LOW + HIGH)
    anywhere = found(gloss, LOW + HIGH)
    return first, anywhere


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lexique", required=True)
    args = ap.parse_args()

    films: dict[str, float] = {}
    books: dict[str, float] = {}
    with open(args.lexique, encoding="utf-8") as fh:
        for r in csv.DictReader(fh, delimiter="\t"):
            if r["cgram"] != "VER":
                continue
            for col, d in (("freqlemfilms2", films), ("freqlemlivres", books)):
                try:
                    d[r["lemme"]] = max(d.get(r["lemme"], 0.0), float(r[col] or 0))
                except ValueError:
                    pass
    keys = set(films) | set(books)
    rank_f = {l: i + 1 for i, l in enumerate(sorted(keys, key=lambda l: -films.get(l, 0)))}
    rank_b = {l: i + 1 for i, l in enumerate(sorted(keys, key=lambda l: -books.get(l, 0)))}

    verbs = []
    for lvl, _, _ in BANDS:
        verbs += json.loads((ROOT / f"content/verbs/{lvl}.json").read_text(encoding="utf-8"))["verbs"]
    verbs.sort(key=lambda v: v["rank"])
    if len(verbs) < 2000:
        print(f"refusing: only {len(verbs)} verbs — content/ is not built.", file=sys.stderr)
        return 2

    rows = []
    for v in verbs:
        inf = v["infinitive"]
        gloss = v["meanings"].get("en", "")
        first, anywhere = sense_registers(gloss)
        f, b = rank_f.get(inf), rank_b.get(inf)
        ratio = (max(f, b) / min(f, b)) if (f and b) else 1.0
        # Commoner in books than in subtitles. The asymmetry is deliberate:
        # a verb skewed towards SPEECH at A1 is usually filed correctly —
        # « désoler » is 80th in subtitles and 1,041st in books and a beginner
        # needs "sorry" in week one. A verb skewed towards BOOKS at A1 is the
        # suspicious direction: it is a written verb being taught first.
        written = bool(f and b and b < f)
        lvl = v["level"]
        low_first = [w for w in first if w in LOW]
        high_first = [w for w in first if w in HIGH]
        low_any = [w for w in anywhere if w in LOW]

        tier, why = 0, []
        if low_first and lvl in ("A1", "A2", "B1"):
            tier, _ = 1, why.append(f"informal on its first sense ({', '.join(low_first)}) at {lvl}")
        elif low_first:
            tier = max(tier, 2); why.append(f"informal on its first sense ({', '.join(low_first)}) at {lvl}")
        if high_first and lvl in ("A1", "A2"):
            tier = 1; why.append(f"literary on its first sense ({', '.join(high_first)}) at {lvl}")
        elif high_first and lvl == "B1":
            tier = max(tier, 2); why.append(f"literary on its first sense ({', '.join(high_first)}) at {lvl}")
        # THE « paumer » PATTERN. paumer is at C1 because it is the 1,402nd most
        # frequent verb, and it is street register. Nothing in the data says
        # "this verb is informal" — Wiktionary labels only its "to lose" sense —
        # so the only available trace is a low-register label somewhere in a
        # verb filed as advanced. A verb at C1/C2 is advanced vocabulary; a
        # colloquial sense there suggests it is informal vocabulary instead.
        if low_any and not low_first and lvl in ("C1", "C2"):
            tier = max(tier, 2)
            why.append(f"colloquial sense in a verb filed {lvl} — the « paumer » pattern")
        if written and ratio >= SKEW_RATIO and lvl in ("A1", "A2"):
            tier = 1; why.append(f"written-skewed {ratio:.1f}x at {lvl} "
                                 f"(books {b}, subtitles {f})")
        elif written and ratio >= SKEW_RATIO and lvl == "B1":
            tier = max(tier, 2); why.append(f"written-skewed {ratio:.1f}x at {lvl}")
        elif (not written) and ratio >= 3.0 and lvl in ("B2", "C1", "C2"):
            tier = max(tier, 2)
            why.append(f"spoken-skewed {ratio:.1f}x at {lvl} — commoner in speech "
                       f"than its level says")

        rows.append({
            "rank": v["rank"], "level": lvl, "inf": inf,
            "headword": v["headword"] or inf, "gloss": gloss or "—",
            "films": f, "books": b, "ratio": ratio, "why": why, "tier": tier,
        })

    tier1 = sorted([r for r in rows if r["tier"] == 1], key=lambda r: r["rank"])
    tier2 = sorted([r for r in rows if r["tier"] == 2], key=lambda r: r["rank"])

    out = ROOT / "docs/reviews"
    out.mkdir(parents=True, exist_ok=True)

    def table(rs, show_why=True):
        head = ("| rank | level | verb | gloss | " + ("evidence | " if show_why else "")
                + "ruling |\n|---:|:--|:--|:--|" + (":--|" if show_why else "") + ":--|")
        body = "\n".join(
            f"| {r['rank']} | {r['level']} | `{r['headword']}` | {r['gloss'][:88]} | "
            + (f"{'; '.join(r['why'])} | " if show_why else "") + " |"
            for r in rs)
        return head + "\n" + body

    (out / "levels-priority.md").write_text(f"""# Level assignment — where frequency is probably lying

**Levels come from raw frequency, and raw frequency is not teaching.**

`paumer` sits at C1 because it is the 1,402nd most frequent verb in French. A C1
learner is reading literature and writing argumentative essays. « Paumer » is
"to lose" in the register you use with friends. **Its frequency is right and its
level is meaningless** — the case that proves the method rather than an
exception to it.

2,392 verbs is not a sitting. This sheet is the {len(tier1) + len(tier2)} where
there is evidence the frequency is misleading, in two tiers so you can stop when
you have had enough. Rank is position among the 2,400 most frequent verbs.

## What the evidence means

**written-skewed / spoken-skewed.** Lexique records `freqlemfilms2` (subtitles)
and `freqlemlivres` (books) separately, and the build **sums them**, destroying
the distinction. The flag is the RATIO of the two ranks, not their difference —
a 300-rank gap is noise at rank 2,000 and enormous at rank 200.

**The asymmetry is deliberate.** « désoler » is 80th in subtitles and 1,041st in
books, a 13x skew, and A1 is exactly right: a beginner needs "sorry" in week
one. A verb skewed towards *speech* early is usually filed correctly. A verb
skewed towards *books* early is the suspicious direction — a written verb being
taught first — so only that direction is tier one.

**informal / literary on its first sense.** A label on the LEADING sense is a
statement about the verb. A label further down is a statement about one of its
uses, and flagging on it is noise: « chercher » is correctly A1 and carries
(slang) on its third sense, "to mess with someone, ask for trouble". An earlier
version of this sheet filled a third of tier one that way — « vouloir »,
« arriver », « entendre », « sentir », all flagged for labels a beginner will
never meet.

**the « paumer » pattern.** A colloquial sense inside a verb filed C1 or C2. A
verb at C1 is advanced vocabulary; a colloquial sense there suggests it is
informal vocabulary instead, which is a different axis from level.

## The blind spot, stated plainly

**Nothing in the data records a verb's register as a whole.** Wiktionary labels
senses, not verbs, so « paumer » — a thoroughly colloquial verb — carries no
label on its first sense at all. Every register signal here is therefore a
trace, not a measurement. **Register is not a field in this project**, which is
why the level ladder has nowhere to say "teach this for comprehension, not
production". {sum(1 for r in rows if r['why'] and any('informal' in w or 'colloquial' in w or 'literary' in w for w in r['why']))} verbs carry a trace of one.

## How to rule

Write in the last column: a level `A1`–`C2`, or `drop` to take the verb out of
the ladder, or `comprehension` to teach it for recognition without drilling
production. Blank means keep.

## Tier 1 — {len(tier1)} verbs, the clearest candidates

{table(tier1)}

## Tier 2 — {len(tier2)} verbs

{table(tier2)}

---

All 2,392 are in `levels-all.md`, grouped by level, for anything this sheet
missed. Regenerate both with:

```sh
python3 scripts/level-review.py --lexique <Lexique383.tsv>
```
""", encoding="utf-8")

    parts = [f"""# Level assignment — all 2,392 verbs

Frequency-assigned levels, for reference. The {len(tier1) + len(tier2)} with
evidence that the frequency is misleading are in `levels-priority.md` and are
the ones worth reading first.

Bands: A1 1–200 · A2 201–500 · B1 501–900 · B2 901–1,400 · C1 1,401–1,900 ·
C2 1,901–2,400.
"""]
    for lvl, _, _ in BANDS:
        rs = [r for r in rows if r["level"] == lvl]
        parts.append(f"\n## {lvl} — {len(rs)} verbs\n\n{table(rs, show_why=False)}")
    (out / "levels-all.md").write_text("\n".join(parts) + "\n", encoding="utf-8")

    print(f"tier 1: {len(tier1)}   tier 2: {len(tier2)}   total {len(tier1)+len(tier2)} of {len(rows)}")
    from collections import Counter
    c = Counter(w.split(" at ")[0].split(" —")[0].split(" (")[0] for r in rows for w in r["why"])
    for k, n in c.most_common():
        print(f"  {n:>4}  {k}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
