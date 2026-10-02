#!/usr/bin/env python3
"""Turn the conjugator's output into the content a learner loads.

Shape, and why:

    content/verbs-index.json     every verb, one line each — infinitive, level,
                                 group, auxiliary, frequency rank, gloss. This
                                 is what the verb LIST and the search read, and
                                 it is the only verb file loaded on an ordinary
                                 visit.
    content/verbs/<level>.json   the full paradigms, one file per CEFR level.

**Sharded by level because that is what a learner's session follows.** Somebody
working at B1 opens B1 verbs; they do not touch C2's paradigms, so there is no
reason to send them. Sharding by first letter would split a session across every
shard, and one file would send 2,392 paradigms to read one.

A verb ships only if the conjugator produced it AND the exception list does not
withhold it. `gésir` is withheld because we conjugate it wrongly; `découverte`
because it is not a verb. Nothing is written on a guess.

Glosses come from en.wiktionary (CC BY-SA 4.0) and are marked `provenance:
"wiktionary-en"`, separately from the conjugations, which are
`provenance: "generated"` — our own rules, validated against two corpora. A
learner's meanings and a learner's conjugations come from different places and
the data says so, because `docs/02` requires provenance per item and not per
file.
"""
from __future__ import annotations

import argparse
import csv
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conjugate import conjugate, PERSONS                    # noqa: E402
from conjugation_exceptions import (ALTERNATES, CORPUS_NOISE, DEFECTIVE,   # noqa: E402
                                    KNOWN_WRONG, NOT_A_VERB, ORACLES_DISAGREE)

ROOT = pathlib.Path(__file__).resolve().parent.parent

# Frequency bands, from docs: the levels a teacher would accept as a draft and
# then move perhaps 150-250 verbs by hand.
BANDS = [("A1", 0, 200), ("A2", 200, 500), ("B1", 500, 900),
         ("B2", 900, 1400), ("C1", 1400, 1900), ("C2", 1900, 2400)]

# The order a learner meets them, which is also the order the UI shows.
TENSES = [
    ("ind:pre", "present", "indicatif", True),
    ("ind:imp", "imparfait", "indicatif", True),
    ("ind:fut", "futur", "indicatif", True),
    ("cnd:pre", "conditionnel", "conditionnel", True),
    ("sub:pre", "subjonctif", "subjonctif", True),
    # Read, not written. A learner meets the passé simple in any B2 text and is
    # never asked to produce it; drilling them on it wastes the evening.
    ("ind:pas", "passe-simple", "indicatif", False),
    ("sub:imp", "subjonctif-imparfait", "subjonctif", False),
]


# Each tense joins the verb to a concept, which is how a wrong answer in a
# conjugation drill reaches the weakness model. The présent splits by group,
# because « les verbes en -er » and « les verbes irréguliers fréquents » are
# different things to be weak at. Every id here is checked against
# content/concepts.json at build time: a typo would silently detach a whole
# tense from a learner's record, which is the kind of fault that reports
# nothing and simply never shows up.
CONCEPT_OF = {
    ("present", "1"): "gram.present.er",
    ("present", "2"): "gram.present.ir",
    ("present", "3"): "gram.present.irregular",
    ("imparfait", None): "gram.past.imparfait",
    ("futur", None): "gram.future.simple",
    ("conditionnel", None): "gram.conditional.present",
    ("subjonctif", None): "gram.subjunctive.present",
    # Read-only tenses have no concept of their own in the taxonomy: nothing
    # drills them, so nothing can be weak at them. Null rather than a wrong id.
    ("passe-simple", None): None,
    ("subjonctif-imparfait", None): None,
}


def concept_for(tense_id: str, group: str) -> str | None:
    if (tense_id, group) in CONCEPT_OF:
        return CONCEPT_OF[(tense_id, group)]
    return CONCEPT_OF.get((tense_id, None))


def group_of(lemma: str, pattern: str) -> str:
    if pattern == "-er":
        return "1"
    if pattern == "-ir regular":
        return "2"
    return "3"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lexique", required=True)
    ap.add_argument("--glosses", help="glosses.json from harvest_glosses.py")
    ap.add_argument("--out", default="content")
    args = ap.parse_args()

    freq: dict[str, float] = {}
    with open(args.lexique, encoding="utf-8") as fh:
        for r in csv.DictReader(fh, delimiter="\t"):
            if r["cgram"] != "VER":
                continue
            try:
                f = float(r["freqlemfilms2"] or 0) + float(r["freqlemlivres"] or 0)
                freq[r["lemme"]] = max(freq.get(r["lemme"], 0.0), f)
            except ValueError:
                pass
    ranked = sorted(freq, key=lambda l: -freq[l])[:2400]
    if len(ranked) < 2000:
        print("refusing: the frequency list is too short to be the real one.", file=sys.stderr)
        return 2

    glosses: dict[str, list[str]] = {}
    if args.glosses and pathlib.Path(args.glosses).exists():
        glosses = json.loads(pathlib.Path(args.glosses).read_text(encoding="utf-8"))["glosses"]

    # Every concept id used below must exist, or a tense is silently detached
    # from the weakness model and nobody finds out.
    live_concepts = {c["id"] for c in json.loads(
        (ROOT / "content/concepts.json").read_text(encoding="utf-8"))["concepts"]
        if not c.get("retired")}
    unknown = [c for c in CONCEPT_OF.values() if c and c not in live_concepts]
    if unknown:
        print(f"refusing: concept ids that do not exist: {unknown}", file=sys.stderr)
        return 2

    out_dir = ROOT / args.out
    (out_dir / "verbs").mkdir(parents=True, exist_ok=True)

    index, shards, withheld = [], {lvl: [] for lvl, _, _ in BANDS}, []
    for rank, lemma in enumerate(ranked):
        level = next(lvl for lvl, a, b in BANDS if a <= rank < b)
        if lemma in KNOWN_WRONG:
            withheld.append((lemma, "known-wrong")); continue
        if lemma in NOT_A_VERB:
            withheld.append((lemma, "not-a-verb")); continue
        pattern, forms = conjugate(lemma)
        if forms is None:
            withheld.append((lemma, pattern)); continue

        gloss = glosses.get(lemma, [])
        group = group_of(lemma, pattern)
        tenses = []
        for slot, tid, mood, produced in TENSES:
            got = forms.get(slot)
            if not got or all(x is None for x in got):
                continue
            tenses.append({
                "id": tid, "mood": mood, "produced": produced,
                "conceptId": concept_for(tid, group),
                "forms": [x or "" for x in got],
            })

        # falloir and pleuvoir are impersonal: « il faut », « il pleut », and
        # nothing else. The empty persons are correct French, not a gap, so the
        # data says which verbs they are rather than leaving a reader to wonder
        # whether five forms went missing.
        pres = next((t["forms"] for t in tenses if t["id"] == "present"), [])
        impersonal = bool(pres) and sum(1 for f in pres if f) <= 2

        entry = {
            "infinitive": lemma,
            "impersonal": impersonal,
            "key": f"v:{lemma}",
            "level": level,
            "rank": rank + 1,
            "group": group,
            "pattern": pattern,
            "irregular": pattern not in ("-er", "-ir regular", "-dre regular"),
            "auxiliary": forms.get("aux", "avoir"),
            "persons": PERSONS and ["je", "tu", "il/elle", "nous", "vous", "ils/elles"],
            "participles": {"past": (forms.get("par:pas") or [""])[0],
                            "present": (forms.get("par:pre") or [""])[0]},
            "imperative": [x for x in (forms.get("imp:pre") or []) if x] or None,
            "tenses": tenses,
            "meanings": {"en": "; ".join(gloss)} if gloss else {},
            "provenance": "generated",
            "licence": "Conjugations generated by rule for this project and "
                       "validated against Lexique 3.83 and fr.wiktionary.org "
                       "(both CC BY-SA 4.0).",
            "glossProvenance": "wiktionary-en" if gloss else None,
            "notes": note_for(lemma),
        }
        shards[level].append(entry)
        index.append({
            "infinitive": lemma, "key": entry["key"], "level": level,
            "rank": entry["rank"], "group": entry["group"],
            "irregular": entry["irregular"], "auxiliary": entry["auxiliary"],
            "en": entry["meanings"].get("en", ""),
        })

    # Every conjugated form back to its infinitive. 82,798 entries, 237 KiB
    # gzipped — too heavy to load with the verb list, which is why the search
    # fetches it only when a query matches no infinitive and no gloss. A learner
    # typing « allons » is doing something reasonable and should find aller;
    # paying 237 KiB on every visit so that a rare search is instant is not.
    forms: dict[str, str] = {}
    for entries in shards.values():
        for e in entries:
            for t in e["tenses"]:
                for f in t["forms"]:
                    if f and f not in forms:
                        forms[f] = e["infinitive"]
            for f in e["participles"].values():
                if f and f not in forms:
                    forms[f] = e["infinitive"]
    (out_dir / "verb-forms.json").write_text(json.dumps({
        "version": 1,
        "note": "Every conjugated form to its infinitive. Fetched only when a "
                "search matches no infinitive and no gloss.",
        "forms": forms,
    }, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")

    (out_dir / "verbs-index.json").write_text(json.dumps({
        "version": 1,
        "note": "Every shippable verb, one line each. The verb list and search read "
                "this and nothing else; paradigms live in content/verbs/<level>.json.",
        "licence": "CC BY-SA 4.0 — see content/attribution.json",
        "verbs": index,
    }, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")

    for level, entries in shards.items():
        (out_dir / "verbs" / f"{level}.json").write_text(json.dumps({
            "version": 1, "level": level, "verbs": entries,
        }, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")

    print(f"index: {len(index)} verbs")
    total = 0
    for level, entries in shards.items():
        size = (out_dir / "verbs" / f"{level}.json").stat().st_size
        total += size
        glossed = sum(1 for e in entries if e["meanings"])
        print(f"  {level}: {len(entries):>4} verbs  {size/1024:>7.1f} KiB  "
              f"{glossed:>4} with a gloss")
    idx = (out_dir / "verbs-index.json").stat().st_size
    forms_kib = (out_dir / "verb-forms.json").stat().st_size / 1024
    print(f"  index    {idx/1024:.1f} KiB   forms index {forms_kib:.1f} KiB "
          f"({len(forms):,} forms)   paradigms total {total/1024/1024:.2f} MiB")
    print(f"withheld: {len(withheld)} — " + ", ".join(f"{l} ({w})" for l, w in withheld))
    return 0


def note_for(lemma: str) -> str | None:
    """Anything a learner should be told about this verb, in their own interest."""
    if lemma in ALTERNATES:
        return ALTERNATES[lemma]
    if lemma in ORACLES_DISAGREE:
        return ORACLES_DISAGREE[lemma]
    if lemma in DEFECTIVE:
        return DEFECTIVE[lemma]
    if lemma in CORPUS_NOISE:
        return None            # a fault in the corpus is not a fact about French
    return None


if __name__ == "__main__":
    raise SystemExit(main())
