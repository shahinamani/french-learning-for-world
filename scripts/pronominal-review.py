#!/usr/bin/env python3
"""Write the pronominal-only review sheet from the content.

Generated rather than hand-written because it has been produced by hand three
times — 51 verbs, then 48, then 44 — and a sheet a teacher rules on must match
the content it describes. `tests/review-sheets.test.js` checks that it does.
"""
from __future__ import annotations

import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
LEVELS = ("A1", "A2", "B1", "B2", "C1", "C2")


def main() -> int:
    rows = []
    for lvl in LEVELS:
        for v in json.loads((ROOT / f"content/verbs/{lvl}.json").read_text(encoding="utf-8"))["verbs"]:
            if v["pronominal"]:
                rows.append(v)
    rows.sort(key=lambda v: v["rank"])
    reviewed = sum(1 for v in rows if v["glossProvenance"] == "teacher")
    body = "\n".join(
        f"| {v['rank']} | {v['level']} | `{v['headword']}` | `{v['infinitive']}` | "
        f"{v['meanings'].get('en', '—')[:88]}"
        f"{' **(teacher-reviewed)**' if v['glossProvenance'] == 'teacher' else ''} |  |"
        for v in rows)
    (ROOT / "docs/reviews/pronominal.md").write_text(f"""# Pronominal-only verbs — {len(rows)}, after a teacher's full pass

51 from Wiktionary's labels alone · 48 after a first reading · **{len(rows)} after
Shahin's pass over all of them on 2026-10-03.**

## Why this list matters more than the glosses

A wrong meaning teaches one wrong word. A wrong reflexive marking teaches a
wrong conjugation on **every row** of the table — which is the defect the list
exists because of: « souvenir » was shown as a bare infinitive with a table
reading « je souviens », six rows of non-French, on an A1 verb.

**The mirror defect is as bad and less visible.** Marking a verb
pronominal-only when it is not teaches that the plain form is wrong, so a verb
removed from this list is as much a correction as one added. Seven have been
removed that way:

| verb | why |
|:--|:--|
| `cabrer` | « cabrer un avion » |
| `évaporer` | « évaporer un liquide » |
| `prostituer` | « prostituer son talent » |
| `rendormir` | « rendormir un enfant » |
| `recoucher` | « recoucher un enfant » |
| `entrecroiser` | « entrecroiser les doigts » |
| `transporter` | caught before shipping — `{{{{lb|fr|transitive|or|pronominal}}}}` read as a conjunction |

And one left the product entirely: `éperdre`, where 100% of the corpus
frequency is « éperdu/e/s/es » and no finite form is attested at all. The
adjective survives; the verb does not.

{reviewed} of these {len(rows)} meanings have been read by a teacher. The rest
carry Wiktionary's, unreviewed, which the page says.

Reciprocals — `s'entretuer`, `s'entraider` — are on the list because they are
pronominal by meaning rather than convention.

## How to rule

Write in the last column: `keep`, `not pronominal-only`, a corrected gloss, or
both. Rulings go into `scripts/gloss_corrections.py`, and the build refuses a
correction that names a verb not in the content.

| rank | level | headword | infinitive | gloss | ruling |
|---:|:--|:--|:--|:--|:--|
{body}

Regenerate with `python3 scripts/pronominal-review.py`.
""", encoding="utf-8")
    print(f"docs/reviews/pronominal.md: {len(rows)} verbs, {reviewed} teacher-reviewed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
