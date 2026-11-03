#!/usr/bin/env python3
"""Check the drafted noun and adjective entries against the word list.

    python3 scripts/check-word-sentences.py [LEVEL ...]

content/word-sentences/<level>.json holds, per word of data/word-frequency-list.json,
an English and a Persian meaning, a noun's article, and one example sentence
with its translations. Drafted, not reviewed. This script checks what the
Lexique data CAN decide:

  - every word of the level has exactly one entry, and nothing else does;
  - a noun's article agrees with Lexique's gender, and elides only before a
    vowel or h; where Lexique has no single gender, the entry must state one;
  - where Lexique offers two plurals, the entry picks one of them;
  - `form` is a literal piece of the sentence and is a form of this word;
  - English and Persian are present; Persian uses ی and ک;
  - `prep` is null or a known preposition.
"""
import json
import pathlib
import re
import sys
import unicodedata

ROOT = pathlib.Path(__file__).resolve().parent.parent
LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"]
VOWEL = re.compile(r"^[aàâäeéèêëiîïoôöuùûüyœæ]", re.I)
PERSIAN = re.compile(r"[؀-ۿ]")
ARABIC_ONLY = re.compile(r"[يك]")
PREPS = {"à", "de", "pour", "avec", "sur", "en", "dans", "contre", "par", "chez", "vers", "envers", "entre", "sans", "sous"}


def fold(s: str) -> str:
    s = unicodedata.normalize("NFD", s.lower().replace("œ", "oe").replace("æ", "ae"))
    return "".join(c for c in s if unicodedata.category(c) != "Mn")


def forms_of(w: dict, e: dict) -> set[str]:
    base = w["lemma"]
    out = {base, base + "s", base + "x", base + "e", base + "es"}
    for k in ("plural", "feminine"):
        v = w.get(k)
        for x in (v if isinstance(v, list) else [v] if v else []):
            out |= {x, x + "s"}
    if e.get("plural"):
        out.add(e["plural"])
    return {fold(x) for x in out}


def check_level(level: str, words: list[dict]) -> list[str]:
    errs: list[str] = []
    want = {w["key"]: w for w in words if w["level"] == level}
    path = ROOT / f"content/word-sentences/{level}.json"
    if not path.exists():
        return [f"{level}: {path.name} missing"]
    entries = json.loads(path.read_text())["entries"]
    keys = [e.get("key") for e in entries]
    if set(want) - set(keys): errs.append(f"{level}: {len(set(want) - set(keys))} words without an entry, e.g. {sorted(set(want) - set(keys))[:5]}")
    if set(keys) - set(want): errs.append(f"{level}: entries for words not in this level: {sorted(set(keys) - set(want))[:5]}")
    dup = {k for k in keys if keys.count(k) > 1}
    if dup: errs.append(f"{level}: duplicated: {sorted(dup)[:5]}")

    for e in entries:
        k = e.get("key"); w = want.get(k)
        if not w: continue
        if e.get("exclude"):
            if not (e.get("reason") or "").strip(): errs.append(f"{k}: excluded without a reason")
            continue
        for lang in ("en", "fa"):
            if not (e.get(lang) or "").strip(): errs.append(f"{k}: no {lang} meaning")
        if w["type"] == "noun":
            art = e.get("article")
            g = w.get("gender")
            if art not in ("le", "la", "l'", "les"):
                errs.append(f"{k}: article {art!r}"); continue
            if art == "l'" and not (VOWEL.match(w["lemma"]) or w["lemma"].startswith("h")):
                errs.append(f"{k}: l' before a consonant")
            if art in ("le", "la") and VOWEL.match(w["lemma"]):
                errs.append(f"{k}: {art} before a vowel")
            if g in ("m", "f"):
                if (art == "le" and g != "m") or (art == "la" and g != "f"):
                    errs.append(f"{k}: article {art} but Lexique says {g}")
                if e.get("gender") and e["gender"] != g:
                    errs.append(f"{k}: gender {e['gender']} but Lexique says {g}")
            else:
                if e.get("gender") not in ("m", "f", "mf"):
                    errs.append(f"{k}: Lexique has no single gender; the entry must give gender m, f or mf")
                elif art == "le" and e["gender"] == "f" or art == "la" and e["gender"] == "m":
                    errs.append(f"{k}: article {art} disagrees with gender {e['gender']}")
            if art == "les" and not w["lemma"].endswith(("s", "x")):
                errs.append(f"{k}: les for a word that is not plural-only")
            if isinstance(w.get("plural"), list) and e.get("plural") not in w["plural"]:
                errs.append(f"{k}: choose the plural from {w['plural']}")
        prep = e.get("prep")
        if prep is not None and prep not in PREPS:
            errs.append(f"{k}: prep {prep!r}")
        ex = e.get("example") or {}
        fr, form = ex.get("fr", ""), ex.get("form", "")
        if not fr or not form:
            errs.append(f"{k}: no example"); continue
        if form.lower() not in fr.lower():
            errs.append(f"{k}: form «{form}» is not in «{fr}»")
        if fold(form) not in forms_of(w, e):
            errs.append(f"{k}: «{form}» is not a form of {w['lemma']}")
        if len(fr.split()) > 16:
            errs.append(f"{k}: sentence longer than 16 words")
        for lang in ("en", "fa"):
            if not (ex.get(lang) or "").strip(): errs.append(f"{k}: example has no {lang}")
        for text in (e.get("fa", ""), ex.get("fa", "")):
            if text and not PERSIAN.search(text): errs.append(f"{k}: Persian has no Persian letters")
            if ARABIC_ONLY.search(text): errs.append(f"{k}: Persian uses Arabic ي or ك")
    return errs


def main() -> None:
    words = json.loads((ROOT / "data/word-frequency-list.json").read_text())["words"]
    levels = sys.argv[1:] or LEVELS
    errs = [x for l in levels for x in check_level(l, words)]
    for x in errs: print(x)
    print(f"{len(errs)} problems in {', '.join(levels)}")
    sys.exit(1 if errs else 0)


if __name__ == "__main__":
    main()
