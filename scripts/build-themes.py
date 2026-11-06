#!/usr/bin/env python3
"""Build the Themes section from its source and the existing cards.

    python3 -I scripts/build-themes.py --lexique ~/.cache/flw/lexique/Lexique383.tsv

Reads data/themes.json, which holds, per theme:
  - its names (fr, en, fa);
  - `words` and `verbs`: KEYS of existing flashcards (content/word-cards,
    content/verb-cards). Meanings, articles and levels are read from the card,
    never copied, so a correction to a card reaches its theme;
  - `extraWords`: theme nouns the frequency list lacks (loyer, réservation),
    drafted by an agent on 2026-11-06 with an estimated level, NOT REVIEWED;
  - `expressions`: drafted set phrases with en and fa, NOT REVIEWED;
and `evidence`: exam tasks read in official sample papers or exam-body
documents, each with its source, the date read and a short quotation.

Writes content/themes.json (the index) and content/themes/<id>.json.

What this script decides, and refuses on:
  - every card key exists;
  - an extra word is a noun in Lexique 3.83, with the gender the draft states
    (an extra word Lexique does not know, or knows with the other gender, is
    dropped and listed: nobody has checked it, and the draft may be wrong);
  - an extra word that is already a card in the same theme is dropped;
  - levels are CEFR levels; Persian uses ی and ک;
  - every evidence row names a theme that exists, a URL and a date.
"""
import argparse
import json
import pathlib
import re
import sys
import unicodedata

ROOT = pathlib.Path(__file__).resolve().parent.parent
LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"]
VOWEL = re.compile(r"^[aàâäeéèêëiîïoôöuùûüyœæ]", re.I)
ARABIC_ONLY = re.compile(r"[يك]")
# Common nouns with an aspirated h: no elision (le hall, la haine). Everything
# else starting with h elides (l'hôtel, l'heure). Unknown h-words are listed
# by the build so a reviewer sees them.
H_ASPIRE = {
    "hache", "haie", "haine", "hall", "hamburger", "hameau", "hanche", "handball", "handicap", "hangar",
    "harcèlement", "haricot", "hasard", "hausse", "hâte", "hauteur", "héros", "hibou", "hiérarchie",
    "hockey", "homard", "honte", "hublot", "hurlement", "hutte", "hamac", "harpe", "hareng", "hayon",
}
H_MUET = {
    "hôtel", "heure", "herbe", "histoire", "hiver", "homme", "hôpital", "horaire", "huile", "habitant",
    "habitude", "habitation", "hébergement", "hôte", "hôtesse", "humeur", "humour", "hypothèque",
    "horizon", "hygiène", "hypothèse", "honneur", "hébergeur", "harmonie", "héritage", "hippopotame",
    "humidité", "humanité", "hirondelle", "horloge", "hôpital", "habillement", "hameçon", "haleine",
}


def fold(s: str) -> str:
    s = unicodedata.normalize("NFD", s.lower().replace("œ", "oe").replace("æ", "ae"))
    return "".join(c for c in s if unicodedata.category(c) != "Mn")


def article(lemma: str, gender: str) -> tuple[str, bool]:
    """The definite article, and whether the h-rule was a guess."""
    low = lemma.lower()
    if VOWEL.match(low):
        return "l’", False
    if low.startswith("h"):
        if low in H_ASPIRE:
            return ("le" if gender == "m" else "la"), False
        return "l’", low not in H_MUET
    return ("le" if gender == "m" else "la"), False


def load_lexique(path: pathlib.Path) -> tuple[dict[str, set[str]], dict[str, set[tuple[str, str]]]]:
    """lemma → genders Lexique records for it as a noun ('' when it records none),
    and written form → (gender, number) of its noun rows. The second answers for
    words a learner meets in one form: « vacances », « cheveux », « belle-mère »
    (which Lexique files under the lemma « beau-père »)."""
    lemmas: dict[str, set[str]] = {}
    forms: dict[str, set[tuple[str, str]]] = {}
    with path.open(encoding="utf-8") as f:
        head = f.readline().rstrip("\n").split("\t")
        i_orth, i_lem, i_cat = head.index("ortho"), head.index("lemme"), head.index("cgram")
        i_gen, i_num = head.index("genre"), head.index("nombre")
        for line in f:
            row = line.rstrip("\n").split("\t")
            if row[i_cat] != "NOM":
                continue
            lemmas.setdefault(row[i_lem], set()).add(row[i_gen])
            forms.setdefault(row[i_orth], set()).add((row[i_gen], row[i_num]))
    return lemmas, forms


def lexique_key(lemma: str) -> str:
    # Lexique writes « œ » as « oe ».
    return lemma.replace("œ", "oe").replace("Œ", "Oe")


def first_sense(en: str) -> str:
    """Verb cards carry every Wiktionary sense; a theme list shows the first."""
    return re.split(r"\s*[;]\s*", en)[0].strip()


def load_cards() -> tuple[dict, dict]:
    words, verbs = {}, {}
    for lv in LEVELS:
        for kind, store in (("word-cards", words), ("verb-cards", verbs)):
            p = ROOT / f"content/{kind}/{lv}.json"
            if not p.exists():
                continue
            for c in json.loads(p.read_text())["cards"]:
                store[c["key"]] = {**c, "level": lv}
    return words, verbs


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lexique", required=True, type=pathlib.Path)
    args = ap.parse_args()

    src = json.loads((ROOT / "data/themes.json").read_text())
    lex, lex_forms = load_lexique(args.lexique)
    word_cards, verb_cards = load_cards()
    errors: list[str] = []
    report: list[str] = []
    ids = [t["id"] for t in src["themes"]]
    if len(set(ids)) != len(ids):
        errors.append("duplicate theme ids")

    evidence_by: dict[str, list] = {i: [] for i in ids}
    for e in src.get("evidence", []):
        for th in e["themes"]:
            if th not in evidence_by:
                errors.append(f"evidence names unknown theme {th}: {e['topic']}")
                continue
            if not (e["source"].get("url", "").startswith("https://") and e["source"].get("readOn")):
                errors.append(f"evidence without url or date: {e['topic']}")
            evidence_by[th].append({k: e[k] for k in ("exam", "level", "paper", "topic", "source", "quote") if k in e})

    out_dir = ROOT / "content/themes"
    out_dir.mkdir(exist_ok=True)
    index = []
    for t in src["themes"]:
        tid = t["id"]
        words, verbs = [], []
        for k in t.get("words", []):
            c = word_cards.get(k)
            if not c:
                errors.append(f"{tid}: no word card {k}")
                continue
            art = c.get("article")
            words.append({"key": k, "fr": c["fr"], "type": c["type"], "article": art,
                          "en": c["en"], "fa": c.get("fa"), "level": c["level"]})
        for k in t.get("verbs", []):
            c = verb_cards.get(k)
            if not c:
                errors.append(f"{tid}: no verb card {k}")
                continue
            verbs.append({"key": k, "fr": c["fr"], "type": "verb", "en": first_sense(c["en"]),
                          "fa": c.get("fa"), "level": c["level"]})

        have = {fold(w["fr"]) for w in words}
        for x in t.get("extraWords", []):
            lemma, gender = x["lemma"].strip(), x["gender"]
            if fold(lemma) in have:
                continue  # already a card in this theme
            genders = lex.get(lexique_key(lemma))
            plural_only = False
            if genders is None:
                rows = lex_forms.get(lexique_key(lemma))
                if not rows:
                    report.append(f"{tid}: dropped « {lemma} »: not a noun in Lexique")
                    continue
                genders = {g for g, _ in rows}
                # Written as a plural (« les vacances »): the article is « les ».
                plural_only = all(n == "p" for _, n in rows)
            if gender not in genders and "" not in genders:
                report.append(f"{tid}: dropped « {lemma} »: draft says {gender}, Lexique says {'/'.join(sorted(genders))}")
                continue
            if x.get("level") not in LEVELS:
                errors.append(f"{tid}: « {lemma} » has level {x.get('level')}")
                continue
            if ARABIC_ONLY.search(x.get("fa", "")):
                errors.append(f"{tid}: « {lemma} » Persian uses Arabic letters")
            art, guessed = ("les", False) if plural_only else article(lemma, gender)
            if guessed:
                report.append(f"{tid}: « {lemma} »: h muet assumed (l’); add to H_ASPIRE or H_MUET")
            words.append({"key": None, "fr": lemma, "type": "noun", "article": art,
                          "en": x["en"], "fa": x.get("fa"), "level": x["level"], "levelEstimated": True})
            have.add(fold(lemma))

        exprs = []
        for x in t.get("expressions", []):
            if x.get("level") not in LEVELS:
                errors.append(f"{tid}: expression level {x.get('level')}: {x['fr']}")
                continue
            if not x.get("en") or not x.get("fr"):
                errors.append(f"{tid}: expression missing text: {x}")
                continue
            if ARABIC_ONLY.search(x.get("fa", "")):
                errors.append(f"{tid}: Persian uses Arabic letters: {x['fr']}")
            exprs.append({"fr": x["fr"], "en": x["en"], "fa": x.get("fa"), "level": x["level"],
                          "use": x.get("use", "both")})

        order = lambda w: (LEVELS.index(w["level"]) if w["level"] else 9, fold(w["fr"]))
        words.sort(key=order)
        verbs.sort(key=order)
        exprs.sort(key=lambda x: LEVELS.index(x["level"]))
        ev = evidence_by[tid]
        exams = sorted({(e["exam"], e["level"]) for e in ev}, key=lambda p: (p[0], p[1] or ""))
        summary = {
            "id": tid,
            "names": t["names"],
            "counts": {"words": len(words), "verbs": len(verbs), "expressions": len(exprs)},
            "exams": [{"exam": a, "level": b} for a, b in exams],
        }
        index.append(summary)
        detail = {**summary, "reviewed": False, "words": words, "verbs": verbs,
                  "expressions": exprs, "evidence": ev}
        (out_dir / f"{tid}.json").write_text(json.dumps(detail, ensure_ascii=False, indent=1) + "\n")

    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    (ROOT / "content/themes.json").write_text(json.dumps({
        "version": 1,
        "builtOn": src["builtOn"],
        "note": src["note"],
        "themes": index,
    }, ensure_ascii=False, indent=1) + "\n")
    for line in report:
        print(line)
    print(f"{len(index)} themes; {sum(x['counts']['words'] for x in index)} words, "
          f"{sum(x['counts']['verbs'] for x in index)} verbs, {sum(x['counts']['expressions'] for x in index)} expressions; "
          f"{sum(len(v) for v in evidence_by.values())} evidence links; {len([r for r in report if 'dropped' in r])} drafted words dropped")
    return 0


if __name__ == "__main__":
    sys.exit(main())
