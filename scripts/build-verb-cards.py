#!/usr/bin/env python3
"""Build the verb flashcards, one file per level, from the verb tables.

    python3 scripts/build-verb-cards.py

Reads content/verbs/<level>.json and writes content/verb-cards/<level>.json.
No network and nothing invented: every field on a card is copied or composed
from data that is already shipped and already checked.

  front    the verb as a learner must read it (the pronominal headword where
           there is one — « se souvenir », never « souvenir »)
  meaning  the English gloss from en.wiktionary, which NO HUMAN HAS READ; the
           card says so on screen
  past     « il » + auxiliary in the present + past participle (passé composé)
  future   « il » + the stored futur form

Why « il » and not « je »: « je » elides (« j'ai », « j'aimerai ») and whether
it elides before an h cannot be read from the spelling (« j'habiterai » but
« je hurlerai »). « il » never elides, so the composed form is right for every
verb without a guess. The reflexive pronoun still elides before a vowel; no
pronominal-only verb starts with h, and this script stops if one ever does.

A verb is skipped, exactly as the verb list skips it, when it has no usable
gloss (`glossWithheld`, or no English) or is not produced.
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"]
VOWEL = re.compile(r"^[aàâäeéèêëiîïoôöuùûüy]", re.I)
AUX_IL = {"avoir": "a", "être": "est"}


def reflexive(form: str) -> str:
    """« se » before a consonant, « s' » before a vowel."""
    return f"s'{form}" if VOWEL.match(form) else f"se {form}"


def card(v: dict) -> dict | None:
    if not v.get("produce") or v.get("glossWithheld") or not v["meanings"].get("en"):
        return None
    tenses = {t["id"]: t for t in v["tenses"]}
    futur = (tenses.get("futur") or {}).get("forms") or []
    participle = v["participles"].get("past")
    if len(futur) < 3 or not futur[2] or not participle:
        sys.exit(f"{v['infinitive']}: no futur or no participle — refusing to guess")

    pronominal = bool(v.get("headword"))
    if pronominal and v["infinitive"][0] in "hH":
        sys.exit(f"{v['infinitive']}: pronominal verb starting with h — elision unknown")
    aux = "être" if pronominal else v["auxiliary"]
    if aux not in AUX_IL:
        sys.exit(f"{v['infinitive']}: unknown auxiliary {aux!r}")

    past_form = f"{AUX_IL[aux]} {participle}"
    future_form = futur[2]
    if pronominal:
        past_form = reflexive(past_form)
        future_form = reflexive(future_form)
    out = {
        "key": v["key"],
        "rank": v["rank"],
        "fr": v.get("headword") or v["infinitive"],
        "en": v["meanings"]["en"],
        "past": {"fr": f"il {past_form}", "form": past_form},
        "future": {"fr": f"il {future_form}", "form": future_form},
    }
    if v.get("register"):
        out["register"] = v["register"]
    return out


def main() -> None:
    outdir = ROOT / "content" / "verb-cards"
    outdir.mkdir(exist_ok=True)
    total = 0
    for level in LEVELS:
        verbs = json.loads((ROOT / "content" / "verbs" / f"{level}.json").read_text())["verbs"]
        cards = [c for c in (card(v) for v in verbs) if c]
        cards.sort(key=lambda c: c["rank"])
        doc = {
            "version": 1,
            "level": level,
            "licence": "CC BY-SA 4.0 — see content/attribution.json",
            "source": "Built by scripts/build-verb-cards.py from content/verbs/"
                      f"{level}.json. Rebuild rather than edit.",
            "reviewNote": "The English meanings are en.wiktionary glosses that no human has "
                          "read for this deck, and the card says so. The past and future "
                          "forms are composed from the checked conjugation tables.",
            "count": len(cards),
            "cards": cards,
        }
        (outdir / f"{level}.json").write_text(
            json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + "\n")
        print(f"{level}: {len(cards)} cards")
        total += len(cards)
    print(f"total: {total}")


if __name__ == "__main__":
    main()
