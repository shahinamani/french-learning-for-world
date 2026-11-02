#!/usr/bin/env python3
"""Check the drafted example sentences against the verb tables.

    python3 scripts/check-verb-sentences.py [LEVEL ...]

content/verb-sentences/<level>.json holds, per verb, one passé composé and one
futur simple sentence with English and Persian translations, and the verb's
usual preposition. They were drafted, not reviewed, and say so. This script
cannot judge the French or the translations; it checks what a table CAN
decide, so that a sentence teaching the wrong form never ships:

  - every verb of the level has exactly one entry, and nothing else does;
  - `form` is a literal piece of its own sentence;
  - the past `form` is the right auxiliary + this verb's participle (agreement
    allowed), with the reflexive pronoun for a pronominal verb;
  - the future `form` is one of this verb's six futur forms;
  - English and Persian are present, and the Persian uses Persian letters
    (ی and ک, not the Arabic ي and ك);
  - `prep` is null or a short preposition.

Exit status 1 with one line per problem.
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"]
AUX = {"avoir": {"ai", "as", "a", "avons", "avez", "ont"},
       "être": {"suis", "es", "est", "sommes", "êtes", "sont"}}
REFLEXIVE = re.compile(r"^(me |te |se |nous |vous |m'|t'|s')", re.I)
PERSIAN = re.compile(r"[؀-ۿ]")
ARABIC_ONLY = re.compile(r"[يك]")   # ي ك
PREPS = {"à", "de", "pour", "avec", "sur", "en", "dans", "contre", "par", "chez",
         "vers", "après", "entre", "sans", "sous", "devant", "derrière", "auprès de",
         "à côté de", "au", "du", "d'", "jusqu'à", "envers", "parmi", "selon", "malgré"}


def participles(p: str) -> set[str]:
    return {p, p + "e", p + "s", p + "es"}


def check_level(level: str) -> list[str]:
    errs: list[str] = []
    tables = {v["key"]: v for v in json.loads((ROOT / f"content/verbs/{level}.json").read_text())["verbs"]}
    want = [c["key"] for c in json.loads((ROOT / f"content/verb-cards/{level}.json").read_text())["cards"]]
    path = ROOT / f"content/verb-sentences/{level}.json"
    if not path.exists():
        return [f"{level}: {path.name} missing"]
    entries = json.loads(path.read_text())["entries"]
    keys = [e.get("key") for e in entries]
    missing = set(want) - set(keys)
    # An excluded verb has already been dropped from the built cards, so it
    # is expected to be absent there; it must still be a verb of this level.
    excluded = {e.get("key") for e in entries if e.get("exclude")}
    missing -= excluded
    extra = set(keys) - set(want) - {k for k in excluded if k in tables}
    dup = {k for k in keys if keys.count(k) > 1}
    if missing: errs.append(f"{level}: {len(missing)} verbs without sentences, e.g. {sorted(missing)[:5]}")
    if extra: errs.append(f"{level}: entries for verbs not in this level: {sorted(extra)[:5]}")
    if dup: errs.append(f"{level}: duplicated: {sorted(dup)[:5]}")

    for e in entries:
        k = e.get("key")
        v = tables.get(k)
        if not v: continue
        if e.get("exclude"):
            # A verb kept off the cards (vulgar in modern use, say) must say why.
            if not (e.get("reason") or "").strip():
                errs.append(f"{k}: excluded without a reason")
            continue
        pron = bool(v.get("headword"))
        auxes = {"être"} if pron else {v["auxiliary"]} | ({v["auxiliaryAlso"]} if v.get("auxiliaryAlso") else set())
        futur = set(next(t for t in v["tenses"] if t["id"] == "futur")["forms"])
        prep = e.get("prep")
        if prep is not None and (not isinstance(prep, str) or prep.strip() not in PREPS):
            errs.append(f"{k}: prep {prep!r} is not a known preposition")
        for tense in ("past", "future"):
            s = e.get(tense) or {}
            fr, form = s.get("fr", ""), s.get("form", "")
            where = f"{k} {tense}"
            if not fr or not form:
                errs.append(f"{where}: empty"); continue
            if form.lower() not in fr.lower():
                errs.append(f"{where}: form «{form}» is not in «{fr}»")
            if len(fr.split()) > 16:
                errs.append(f"{where}: sentence longer than 16 words")
            body = form
            if pron:
                if not REFLEXIVE.match(form):
                    errs.append(f"{where}: pronominal verb, but «{form}» has no reflexive pronoun"); continue
                body = REFLEXIVE.sub("", form, count=1)
            elif REFLEXIVE.match(form):
                # A verb learners mostly meet reflexively (« se dépêcher », « se
                # taire ») may be taught that way; its compound tenses then take être.
                body = REFLEXIVE.sub("", form, count=1)
                if tense == "past":
                    auxes = {"être"}
            if tense == "past":
                parts = body.split()
                if len(parts) != 2 or parts[0].lower() not in set().union(*(AUX[a] for a in auxes)) \
                        or parts[1] not in participles(v["participles"]["past"]):
                    errs.append(f"{where}: «{form}» is not {'/'.join(sorted(auxes))} + {v['participles']['past']}")
            else:
                if body not in futur:
                    errs.append(f"{where}: «{form}» is not a futur form of {v['infinitive']}")
            for lang in ("en", "fa"):
                if not (s.get(lang) or "").strip():
                    errs.append(f"{where}: no {lang} translation")
            fa = s.get("fa", "")
            if fa and not PERSIAN.search(fa):
                errs.append(f"{where}: Persian has no Persian letters")
            if ARABIC_ONLY.search(fa):
                errs.append(f"{where}: Persian uses Arabic ي or ك")
    return errs


def main() -> None:
    levels = sys.argv[1:] or LEVELS
    errs = [x for l in levels for x in check_level(l)]
    for x in errs: print(x)
    print(f"{len(errs)} problems in {', '.join(levels)}")
    sys.exit(1 if errs else 0)


if __name__ == "__main__":
    main()
