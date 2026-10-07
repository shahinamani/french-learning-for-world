#!/usr/bin/env python3
"""Counts the portal, for the landing page to state.

A stranger's first screen makes claims — how many verbs, how many exam
questions, how much is missing — and those are the claims most likely to be
read and least likely to be re-measured. This project has already shipped a
comment stating 26 KB when the file was 71 KB, because the number was typed
once and nothing checked it afterwards.

So the landing page states no number of its own. It states these, and
`tests/portal-summary.test.js` recomputes every one of them from the content
and fails when this file falls behind. The file is ~700 bytes, is imported
into the bundle rather than fetched, and is therefore present during the
build-time prerender — which is the version a stranger arriving from a search
engine actually reads.

Deliberately NOT taken from content/concept-material.json's `theOneNumber`.
That string says "79 flashcards · 111 exam items", and those are
concept-ATTRIBUTIONS — a card tagged with four concepts counts four times. The
true figures are 22 and 76. It is a fine number for a build report and a 46%
overstatement on a front page.
"""
from __future__ import annotations

import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
LEVELS = ("A1", "A2", "B1", "B2", "C1", "C2")


def read(name: str) -> dict:
    return json.loads((CONTENT / name).read_text(encoding="utf-8"))


def main() -> int:
    verbs_index = read("verbs-index.json")["verbs"]
    by_level = {lvl: sum(1 for v in verbs_index if v["level"] == lvl) for lvl in LEVELS}

    # Every conjugated form a search can resolve, including the tenses a learner
    # only ever reads.
    forms_searchable = len(read("verb-forms.json")["forms"])

    # The forms a learner is actually ASKED to produce — the passé simple is
    # read and never drilled, so counting it would promise practice no screen
    # offers. This is the same rule build-concept-material.py applies.
    forms_drilled = 0
    for lvl in LEVELS:
        for verb in read(f"verbs/{lvl}.json")["verbs"]:
            if not verb.get("produce", True):
                continue
            for tense in verb["tenses"]:
                if tense["conceptId"] and tense["produced"]:
                    forms_drilled += len([f for f in tense["forms"] if f])

    decks = read("decks.json")["decks"]
    cards = 0
    for deck in decks:
        cards += len(read(deck["file"])["cards"])

    papers = read("exam-papers.json")["papers"]
    exam_items = sum(len(p["items"]) for p in papers)
    reviewed = sum(1 for p in papers for i in p["items"]
                   if (i.get("review") or {}).get("state") == "approved")

    concepts = read("concepts.json")["concepts"]
    live = {c["id"]: c for c in concepts if not c.get("isGroup") and not c.get("retired")}
    material = read("concept-material.json")["material"]
    with_material = [cid for cid in live if cid in material]

    # The ceiling is DERIVED, not declared. "Practice stops at B2" is a claim
    # about the content, and the content is the only thing entitled to make it:
    # if one C1 exercise ever lands, this number moves on its own and the
    # landing page stops saying B2 without anybody remembering to edit it.
    levels_with_material = [lvl for lvl in LEVELS
                            if any(live[cid]["level"] == lvl for cid in with_material)]
    ceiling = levels_with_material[-1] if levels_with_material else None

    # Verified means ONE thing: the structure block carries the date somebody
    # read an official paper. The first version of this asked for a
    # `structureUnverifiedWhileOffering` flag, which does not exist in this
    # file — so every examination came back "verified", including TEF, whose
    # own note says NOT VERIFIED in capitals. A landing page would have told a
    # stranger we had checked the TEF grid. Twelfth time this month that a
    # check of mine compared the wrong two things; the field that IS the
    # answer is `structure.verifiedOn`, and null is not a date.
    exams = read("exams.json")["exams"]
    verified, unverified = [], []
    for e in exams:
        if not e.get("preparationOffered"):
            continue
        when = (e.get("structure") or {}).get("verifiedOn")
        (verified if when else unverified).append(e["code"])

    # Which examination each practice paper belongs to, read from the paper's
    # own exam field rather than guessed from its id.
    coverage: dict[str, list[str]] = {}
    for p in papers:
        family = (p.get("exam") or p["id"].split("-")[0]).upper()
        coverage.setdefault(family, []).append(p["level"])
    coverage = {k: sorted(set(v)) for k, v in sorted(coverage.items())}

    out = {
        "version": 1,
        "note": ("Counted from the content by scripts/build-portal-summary.py. "
                 "tests/portal-summary.test.js recomputes all of it and fails "
                 "when this file is stale. No number on the landing page is "
                 "typed by hand."),
        "verbs": len(verbs_index),
        "verbsByLevel": by_level,
        "formsSearchable": forms_searchable,
        "formsDrilled": forms_drilled,
        "cards": cards,
        "cardDecks": len(decks),
        "cardLevels": sorted({d["level"] for d in decks}),
        "papers": len(papers),
        "examItems": exam_items,
        "examItemsReviewed": reviewed,
        "liveConcepts": len(live),
        "conceptsWithMaterial": len(with_material),
        "conceptsWithoutMaterial": len(live) - len(with_material),
        "practiceCeiling": ceiling,
        "examsVerified": sorted(verified),
        "examsUnverified": sorted(unverified),
        "paperCoverage": coverage,
    }

    path = CONTENT / "portal-summary.json"
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"portal-summary.json — {path.stat().st_size} bytes")
    print(f"  {out['verbs']} verbs, {out['formsSearchable']:,} forms searchable, "
          f"{out['formsDrilled']:,} drilled")
    print(f"  {out['cards']} cards in {out['cardDecks']} deck(s); "
          f"{out['examItems']} exam items, {out['examItemsReviewed']} reviewed")
    print(f"  {out['conceptsWithoutMaterial']} of {out['liveConcepts']} live concepts "
          f"have nothing to practise; practice ceiling {out['practiceCeiling']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
