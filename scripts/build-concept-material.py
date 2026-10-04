#!/usr/bin/env python3
"""How many exercises reach each concept, counted once at build time.

The learn map promised six skills at six levels, and 18 of those promises
resolved to "Not built yet". Replacing that with a list of the level's concepts
fixes the dead end — but only if the list says which concepts have anything
behind them, because:

    261 live non-group concepts
     65 with any exercise at all
    196 with none
      0 of 71 at C1 and C2

A list of 22 concepts where 18 are empty is the same lie one level down.

This is computed HERE rather than in the browser so there is one source of
truth. A client that re-counted could disagree with the page that shows the
counts, and nothing would notice; `tests/concept-material.test.js` compares this
file against the content it is derived from, which is the only kind of check
that can see a generator going wrong.

Counts are of EXERCISES, not of concepts. One concept with 2,389 drillable verb
forms and one with a single exam item are not the same offer to a learner.
"""
from __future__ import annotations

import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
LEVELS = ("A1", "A2", "B1", "B2", "C1", "C2")


def main() -> int:
    content = ROOT / "content"
    concepts = json.loads((content / "concepts.json").read_text(encoding="utf-8"))["concepts"]
    live = {c["id"] for c in concepts if not c.get("isGroup") and not c.get("retired")}

    counts: dict[str, dict[str, int]] = {}

    def bump(cid: str, key: str, n: int = 1) -> None:
        if cid not in live:
            return          # a group or a retired concept is not a place to practise
        row = counts.setdefault(cid, {"cards": 0, "verbForms": 0, "examItems": 0, "total": 0})
        row[key] += n
        row["total"] += n

    decks = json.loads((content / "decks.json").read_text(encoding="utf-8"))["decks"]
    for d in decks:
        for card in json.loads((content / d["file"]).read_text(encoding="utf-8"))["cards"]:
            for cid in card.get("conceptIds", []):
                bump(cid, "cards")

    for lvl in LEVELS:
        for verb in json.loads((content / f"verbs/{lvl}.json").read_text(encoding="utf-8"))["verbs"]:
            # Only what a learner is actually asked to produce. The passé simple
            # is read and never drilled, so counting it would promise practice
            # that no screen offers.
            if not verb.get("produce", True):
                continue
            for tense in verb["tenses"]:
                if tense["conceptId"] and tense["produced"]:
                    bump(tense["conceptId"], "verbForms", len([f for f in tense["forms"] if f]))

    papers = json.loads((content / "exam-papers.json").read_text(encoding="utf-8"))["papers"]
    for paper in papers:
        for item in paper["items"]:
            for cid in item.get("conceptIds", []):
                bump(cid, "examItems")

    with_material = len(counts)
    by_source = {k: sum(v[k] for v in counts.values())
                 for k in ("cards", "verbForms", "examItems")}
    out = {
        "version": 1,
        "theOneNumber": (
            f"{by_source['verbForms']:,} verb forms · {by_source['cards']:,} flashcards · "
            f"{by_source['examItems']:,} exam items. "
            f"{100 * by_source['verbForms'] / sum(by_source.values()):.1f}% of every "
            "exercise in this product is a verb form. That is the honest state of the "
            "project, and it is the measurement that should have existed before anybody "
            "asked for more verbs."),
        "note": "Exercises reaching each live, non-group concept, counted at build time "
                "from the decks, the verb paradigms and the exam papers. A concept absent "
                "from `material` has NO exercise: that is true of "
                f"{len(live) - with_material} of the {len(live)} live concepts, and of "
                "every concept at C1 and C2.",
        "generatedBy": "scripts/build-concept-material.py",
        "liveConcepts": len(live),
        "conceptsWithMaterial": with_material,
        "material": dict(sorted(counts.items())),
    }
    (content / "concept-material.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=0) + "\n", encoding="utf-8")

    print(f"concept-material.json: {with_material} of {len(live)} live concepts have material")
    print(f"  exercises: {by_source}")
    print(f"  {out['theOneNumber']}")
    for lvl in LEVELS:
        here = [c for c in concepts if not c.get("isGroup") and not c.get("retired")
                and c["level"] == lvl]
        n = sum(1 for c in here if c["id"] in counts)
        print(f"  {lvl}: {n:>3} of {len(here):>3} concepts have an exercise")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
