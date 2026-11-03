#!/usr/bin/env python3
"""Build the noun and adjective flashcards, one file per level.

    python3 scripts/build-word-cards.py

Reads data/word-frequency-list.json (from Lexique: the word, its type, gender,
plural, feminine) and content/word-sentences/<level>.json (drafted: meanings,
article, example sentence), and writes content/word-cards/<level>.json plus
content/word-cards/index.json (key → level, so a card due today is found
whatever level the learner has open). Rebuild rather than edit.

A word with no drafted entry yet, or one held back (`exclude`), gets no card:
a card with no meaning would be a front without a back.
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"]


def main() -> None:
    words = json.loads((ROOT / "data/word-frequency-list.json").read_text())["words"]
    outdir = ROOT / "content" / "word-cards"
    outdir.mkdir(exist_ok=True)
    index = {}
    for level in LEVELS:
        path = ROOT / f"content/word-sentences/{level}.json"
        drafted = {e["key"]: e for e in json.loads(path.read_text())["entries"]} if path.exists() else {}
        cards = []
        for w in (w for w in words if w["level"] == level):
            e = drafted.get(w["key"])
            if not e or e.get("exclude"):
                continue
            c = {"key": w["key"], "rank": w["rank"], "type": w["type"], "fr": w["lemma"],
                 "en": e["en"], "fa": e["fa"]}
            if w["type"] == "noun":
                c["article"] = e["article"]
                c["gender"] = w["gender"] if w.get("gender") in ("m", "f") else e.get("gender")
                plural = e.get("plural") or w.get("plural")
                if isinstance(plural, str) and plural != w["lemma"]:
                    c["plural"] = plural
            if isinstance(w.get("feminine"), str) and w["feminine"] != w["lemma"]:
                c["feminine"] = w["feminine"]
            for k in ("prep", "construction"):
                if e.get(k):
                    c[k] = e[k]
            ex = e["example"]
            c["example"] = {"fr": ex["fr"], "form": ex["form"], "en": ex["en"], "fa": ex["fa"]}
            cards.append(c)
            index[w["key"]] = level
        (outdir / f"{level}.json").write_text(json.dumps({
            "version": 1, "level": level,
            "licence": "CC BY-SA 4.0 — see content/attribution.json",
            "source": "Words, gender, plural and feminine from Lexique 3.83 (data/word-frequency-list.json). "
                      "Meanings, article and example sentence drafted, NOT REVIEWED "
                      f"(content/word-sentences/{level}.json, checked by scripts/check-word-sentences.py). "
                      "Built by scripts/build-word-cards.py; rebuild rather than edit.",
            "count": len(cards), "cards": cards,
        }, ensure_ascii=False, separators=(",", ":")) + "\n")
        print(f"{level}: {len(cards)} cards")
    (outdir / "index.json").write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main()
