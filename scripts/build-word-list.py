#!/usr/bin/env python3
"""The nouns and adjectives a learner should meet first, from Lexique 3.83.

    python3 -I scripts/build-word-list.py --lexique ~/.cache/flw/lexique/Lexique383.tsv

Writes data/word-frequency-list.json: 2,400 lemmas in frequency order, each
with its type, gender, plural (nouns) or feminine (adjectives), and level.
Everything here is read from Lexique; nothing is written by hand or by a
model. Meanings and sentences are drafted separately (content/word-sentences).

Choices, each a rule rather than a list:
  - frequency is freqlemfilms2 + freqlemlivres, as for the verbs;
  - only the categories NOM and ADJ (not ADJ:ind, ADJ:pos, ADJ:num: those are
    determiners such as « tout », « mon », « deux »);
  - a lemma is kept only if NOM/ADJ is at least half of its use: « pas »,
    « bien », « point » are adverbs or particles far more than nouns;
  - one card per lemma: a word that is both noun and adjective (« jeune »)
    takes the more frequent reading;
  - letters, abbreviations and one-letter words are dropped.
The bands are the verbs' bands (scripts/build-verbs.py), so a B1 noun and a
B1 verb sit at the same depth of the frequency list.
"""
import argparse
import csv
import json
import pathlib
import re
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parent.parent
BANDS = [("A1", 0, 200), ("A2", 200, 500), ("B1", 500, 900),
         ("B2", 900, 1400), ("C1", 1400, 1900), ("C2", 1900, 2400)]
# Lemmas whose Lexique rows join two nouns of different gender, so no rule can
# read the gender: « la mort » (death) and « le mort » / « la morte » (a dead
# person) are one lemma. Gender is left to the drafted entry, which must state it.
AMBIGUOUS_GENDER = {"mort": "la mort (death) and le mort / la morte (dead person) share the lemma"}
# Feminine rows Lexique files under a masculine noun that are not its feminine
# for a learner: another word (« ridelle », « dragonne »), a sense that is not
# the feminine of this one (« la nouvelle » is the news), or a rare or crude
# form. These nouns are shown as masculine only. Read 2026-11-03, by hand.
NOT_FEMININE = {
    "fer": "« fère » is not a word in use", "rideau": "« ridelle » is a different word",
    "rayon": "« rayonne » is rayon fabric", "dragon": "« dragonne » is a wrist strap",
    "nouveau": "« la nouvelle » is the news", "cochon": "« cochonne » is crude",
    "chou": "« choute » is baby talk", "fumier": "« fumière » is not in use",
    "bistrot": "« bistrote » is not in use", "pigeon": "« pigeonne » is rare",
    "démon": "« démone » is rare", "voyou": "« voyoute » is rare",
    "procureur": "the feminine in use is « procureure », which Lexique lacks",
}
WORD = re.compile(r"^[a-zàâäçéèêëîïôöùûüÿœæ][a-zàâäçéèêëîïôöùûüÿœæ'\-]*[a-zàâäçéèêëîïôöùûüÿœæ]$")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lexique", required=True)
    ap.add_argument("--out", default=str(ROOT / "data" / "word-frequency-list.json"))
    args = ap.parse_args()

    use = defaultdict(lambda: defaultdict(float))      # lemma -> cgram -> frequency
    forms = defaultdict(lambda: defaultdict(set))       # (lemma, cgram) -> "genre:nombre" -> orthos
    with open(args.lexique, encoding="utf-8") as f:
        for row in csv.DictReader(f, delimiter="\t"):
            lemma, cgram = row["lemme"], row["cgram"]
            freq = float(row["freqlemfilms2"] or 0) + float(row["freqlemlivres"] or 0)
            use[lemma][cgram] = max(use[lemma][cgram], freq)   # lemma frequency repeats per row
            if cgram in ("NOM", "ADJ"):
                forms[(lemma, cgram)][f"{row['genre']}:{row['nombre']}"].add(row["ortho"])

    picked = []
    for lemma, by in use.items():
        if not WORD.match(lemma) or len(lemma) < 3:
            continue
        mine = {c: by[c] for c in ("NOM", "ADJ") if by.get(c)}
        if not mine:
            continue
        total = sum(by.values())
        if sum(mine.values()) < total / 2:
            continue
        cgram = max(mine, key=mine.get)
        picked.append((mine[cgram], lemma, cgram))
    picked.sort(key=lambda x: (-x[0], x[1]))
    picked = picked[:2400]

    out = []
    for rank, (freq, lemma, cgram) in enumerate(picked):
        level = next(l for l, a, b in BANDS if a <= rank < b)
        fm = forms[(lemma, cgram)]
        entry = {"rank": rank + 1, "lemma": lemma, "level": level, "frequency": round(freq, 2)}
        if cgram == "NOM":
            # Lexique often leaves the singular row's genre empty and records it
            # on the plural row only (« main », « maison »), so every row counts.
            # Where no row has one (« livre »: le livre / la livre), gender is
            # null and the drafted article decides, marked as drafted.
            genders = {k.split(":")[0] for k in fm if k.split(":")[0] in ("m", "f")}
            # « ami » / « amie » share a lemma: the feminine is a separate form,
            # so the headword itself is masculine and the feminine is recorded.
            fem_forms = sorted({o for k, v in fm.items() if k == "f:s" for o in v} - {lemma})
            if lemma in NOT_FEMININE:
                fem_forms = []
                genders = {"m"}
            if lemma in AMBIGUOUS_GENDER:
                genders = set()
                fem_forms = []
            # Lexique may record the genre on the feminine row only
            # (« professeure » f, « professeur » blank), so a separate feminine
            # form is enough: the headword is the masculine.
            if fem_forms:
                genders = {"m"}
                entry["feminine"] = fem_forms[0]
                plural_keys = ("m:p", ":p")
            elif lemma in NOT_FEMININE:
                plural_keys = ("m:p", ":p")
            else:
                plural_keys = None
            plural = sorted({o for k, v in fm.items() if k.endswith(":p") and (plural_keys is None or k in plural_keys)
                             for o in v} - {lemma})
            entry.update(type="noun", key=f"n:{norm(lemma)}",
                         gender="".join(sorted(genders)) or None,
                         plural=plural[0] if len(plural) == 1 else (lemma if not plural else plural))
        else:
            fem = sorted({o for k, v in fm.items() if k == "f:s" for o in v} - {lemma})
            entry.update(type="adjective", key=f"a:{norm(lemma)}",
                         feminine=fem[0] if len(fem) == 1 else (lemma if not fem else fem))
        for k in ("lemma", "plural", "feminine"):
            if k in entry:
                entry[k] = lig(entry[k])
        out.append(entry)

    # Keys fold accents (app/cardKey.js), so « côté » and « côte », « péché »
    # and « pêche » would share one review history. The more frequent word keeps
    # the plain key; the other is told apart with « #2 ».
    seen = set()
    for e in out:
        if e["key"] in seen:
            e["key"] += "#2"
        seen.add(e["key"])

    pathlib.Path(args.out).write_text(json.dumps({
        "version": 1,
        "source": "Lexique 3.83 (lexique.org), CC BY-SA 4.0; built by scripts/build-word-list.py",
        "rule": "NOM and ADJ lemmas, freqlemfilms2 + freqlemlivres, NOM/ADJ at least half of the lemma's use, top 2,400; verb bands",
        "words": out,
    }, ensure_ascii=False, indent=0) + "\n")
    counts = defaultdict(lambda: defaultdict(int))
    for e in out:
        counts[e["level"]][e["type"]] += 1
    for l, *_ in BANDS:
        print(l, dict(counts[l]))


def lig(text):
    """Lexique writes « œ » as « oe » (coeur, soeur, oeil, oeuvre). Before u or i
    it is always the ligature in French spelling; elsewhere (coexister,
    moelle) it is two letters, so only those two contexts are restored."""
    if isinstance(text, list):
        return [lig(t) for t in text]
    return re.sub(r"oe(?=[ui])", "œ", text) if isinstance(text, str) else text


def norm(text: str) -> str:
    import unicodedata
    text = text.replace("œ", "oe").replace("æ", "ae")
    t = unicodedata.normalize("NFD", text.strip().lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", "-", t.replace("'", "").replace("’", ""))


if __name__ == "__main__":
    main()
