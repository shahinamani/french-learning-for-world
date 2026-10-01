#!/usr/bin/env python3
"""Conjugate French verbs by rule, and check every form against real data.

**Why by rule rather than from a table.** The obvious move is to take a
conjugation database. Verbiste is GPL-2+ (read from Debian's copyright file,
not from memory — an earlier draft of this said GPL-3.0 and was wrong), and
GPL of any version cannot flow into CC BY-SA content: the compatibility runs
the other way. Morphalou and GLAFF are LGPL-LR, whose relationship to CC BY-SA
is unsettled. So the tables are out, and that turns out to be fine, because a
conjugation *algorithm* is not a copy of anyone's table. The rules below are
ordinary French grammar, written here.

**Lexique 3.83 (CC BY-SA 4.0) is not used as a source. It is used as an
oracle.** It is corpus-attested, so it contains only forms that actually
occurred — exactly eleven of its 6,399 verbs have a complete six-tense
paradigm, which is why it cannot be the source. But those attested forms are
real French, and every form this script generates that Lexique also attests
must match it exactly. A verb whose generated forms disagree with the corpus
does not ship.

That is the whole design: generate everything, trust nothing, and let the
corpus veto.

Usage:
    python3 scripts/conjugate.py --verb être
    python3 scripts/conjugate.py --validate Lexique383.tsv --top 2400
"""
from __future__ import annotations

import argparse
import collections
import csv
import json
import pathlib
import sys
import unicodedata

PERSONS = ["1s", "2s", "3s", "1p", "2p", "3p"]

# Endings that begin with a mute e, where the stem of many -er verbs changes.
MUTE_E_SLOTS = {("ind:pre", p) for p in ("1s", "2s", "3s", "3p")} | \
               {("sub:pre", p) for p in ("1s", "2s", "3s", "3p")}

# -eler / -eter verbs that take è rather than a doubled consonant. The 1990
# reform made è the default for all but appeler, jeter and their derivatives;
# this is the conservative list, which is what a learner meets in print.
E_GRAVE_ELER_ETER = {
    "acheter", "racheter", "haleter", "crocheter", "fureter",
    "geler", "dégeler", "congeler", "surgeler", "celer", "déceler", "receler",
    "ciseler", "démanteler", "écarteler", "marteler", "modeler", "peler",
}

REGULAR_IR_ENDINGS = {  # the -iss- family: finir, choisir, réussir …
    "ind:pre": ["is", "is", "it", "issons", "issez", "issent"],
    "ind:imp": ["issais", "issais", "issait", "issions", "issiez", "issaient"],
    "sub:pre": ["isse", "isses", "isse", "issions", "issiez", "issent"],
}

ER_ENDINGS = {
    "ind:pre": ["e", "es", "e", "ons", "ez", "ent"],
    "ind:imp": ["ais", "ais", "ait", "ions", "iez", "aient"],
    "sub:pre": ["e", "es", "e", "ions", "iez", "ent"],
}

FUT_ENDINGS = ["ai", "as", "a", "ons", "ez", "ont"]
CND_ENDINGS = ["ais", "ais", "ait", "ions", "iez", "aient"]


def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if not unicodedata.combining(c))


def soften(stem: str, ending: str) -> str:
    """c → ç and g → ge before a and o, so that the sound does not harden."""
    if not ending:
        return stem
    if ending[0] in "ao":
        if stem.endswith("c"):
            return stem[:-1] + "ç"
        if stem.endswith("g"):
            return stem + "e"
    return stem


def er_mute_stem(lemma: str, stem: str) -> str | None:
    """The stem an -er verb uses before a mute e, or None if it does not change."""
    if lemma.endswith(("eler", "eter")):
        if lemma in E_GRAVE_ELER_ETER:
            return stem[:-2] + "è" + stem[-1]          # achet- → achèt-
        return stem + stem[-1]                          # appel- → appell-
    if lemma.endswith("yer"):
        # -ayer admits paye and paie; the corpus overwhelmingly attests the
        # i-form, so that is what ships, with the y-form a known alternate.
        return stem[:-1] + "i"                          # emploie, essuie
    body = stem
    # e_er (lever → lève) and é_er (préférer → préfère, régler → règle). The
    # vowel may be separated from the ending by more than one consonant, which
    # is the case the first version missed.
    i = len(body) - 1
    while i >= 0 and body[i] not in "aeiouyéèêëàâîïôûù":
        i -= 1
    if i < 0 or i >= len(body) - 1:
        return None
    consonants_after = len(body) - 1 - i
    if body[i] == "é":
        # é + any consonants: préférer → préfère, régler → règle, sécher → sèche.
        return body[:i] + "è" + body[i + 1:]
    # x is one letter and two sounds, so « vexer » behaves like a cluster and
    # keeps its e: vexe, not « vèxe ».
    if body[i] == "e" and consonants_after == 1 and body[i + 1] != "x":
        # Plain e only when a SINGLE consonant follows: lever → lève, peser →
        # pèse. Allowing a cluster here turned penser into « pènse » and rester
        # into « rèste » — a fix for one rule breaking a commoner one, which the
        # corpus reported within seconds.
        return body[:i] + "è" + body[i + 1:]
    return None


def conjugate_er(lemma: str) -> dict:
    stem = lemma[:-2]
    mute = er_mute_stem(lemma, stem)
    out: dict[str, list[str]] = {}
    for slot, endings in ER_ENDINGS.items():
        forms = []
        for p, end in zip(PERSONS, endings):
            base = mute if (mute and (slot, p) in MUTE_E_SLOTS) else stem
            forms.append(soften(base, end) + end)
        out[slot] = forms
    # Future and conditional build on the infinitive, with the changed stem
    # where there is one — lèvera, appellera, paiera, but préférera.
    # The future and conditional are built on the infinitive. Verbs whose stem
    # changes e → è keep that change there (lèvera, appellera, paiera), but
    # verbs whose stem changes é → è do NOT: répétera, not répètera. The corpus
    # caught this on répéter, inquiéter and protéger.
    fut_stem = lemma
    e_grave_from_e_acute = len(stem) >= 2 and "é" in stem[-3:]
    if mute and not e_grave_from_e_acute:
        fut_stem = mute + "er"
    out["ind:fut"] = [fut_stem + e for e in FUT_ENDINGS]
    out["cnd:pre"] = [fut_stem + e for e in CND_ENDINGS]
    out["par:pas"] = [stem + "é"]
    out["par:pre"] = [soften(stem, "ant") + "ant"]
    out["imp:pre"] = [out["ind:pre"][1], out["ind:pre"][3], out["ind:pre"][4]]
    return out


def conjugate_ir_regular(lemma: str) -> dict:
    stem = lemma[:-2]
    out = {slot: [stem + e for e in endings] for slot, endings in REGULAR_IR_ENDINGS.items()}
    out["ind:fut"] = [lemma + e for e in FUT_ENDINGS]
    out["cnd:pre"] = [lemma + e for e in CND_ENDINGS]
    out["par:pas"] = [stem + "i"]
    out["par:pre"] = [stem + "issant"]
    out["imp:pre"] = [out["ind:pre"][1], out["ind:pre"][3], out["ind:pre"][4]]
    return out


# -ir verbs that are NOT the -iss- family. Routing these through the regular
# pattern is worse than refusing them: it produces confident nonsense
# ("partis" for « je pars ») that a learner would believe. The oracle caught
# every one of them, which is the argument for having an oracle.
IRREGULAR_IR_STEMS = (
    "venir", "tenir", "partir", "sortir", "dormir", "servir", "mentir", "sentir",
    "courir", "mourir", "ouvrir", "offrir", "souffrir", "couvrir", "cueillir",
    "fuir", "vêtir", "bouillir", "faillir", "saillir", "acquérir", "quérir",
)


def conjugate(lemma: str) -> tuple[str, dict] | tuple[str, None]:
    """Returns (pattern, forms). `None` forms mean: not handled yet, do not ship.

    Refusing is a first-class outcome. A verb this script cannot do correctly
    must not get a confident wrong answer — « je partis » for « je pars » is
    worse than a gap, because a gap is visible and a wrong form is believed.
    """
    if lemma.endswith("oir"):
        return ("unhandled -oir", None)          # avoir, pouvoir, savoir, devoir…
    if lemma == "aller" or lemma.endswith(("envoyer",)):
        # aller is suppletive; envoyer has an irregular future (enverra).
        return ("unhandled -er irregular", None)
    if lemma.endswith("er"):
        return ("-er", conjugate_er(lemma))
    if lemma.endswith(IRREGULAR_IR_STEMS):
        return ("unhandled -ir irregular", None)
    if lemma.endswith("ir"):
        return ("-ir regular", conjugate_ir_regular(lemma))
    return ("unhandled -re/other", None)


# ── Validation against the corpus ───────────────────────────────────────────

SLOT_FROM_TAG = {
    "ind:pre": "ind:pre", "ind:imp": "ind:imp", "ind:fut": "ind:fut",
    "cnd:pre": "cnd:pre", "sub:pre": "sub:pre",
}


def load_oracle(path: str) -> tuple[dict, dict]:
    attested: dict[str, dict[tuple[str, str], set[str]]] = collections.defaultdict(
        lambda: collections.defaultdict(set))
    freq: dict[str, float] = {}
    with open(path, encoding="utf-8") as fh:
        for r in csv.DictReader(fh, delimiter="\t"):
            if r["cgram"] != "VER":
                continue
            lem = r["lemme"]
            try:
                f = float(r["freqlemfilms2"] or 0) + float(r["freqlemlivres"] or 0)
                freq[lem] = max(freq.get(lem, 0.0), f)
            except ValueError:
                pass
            for tag in r["infover"].strip(";").split(";"):
                if not tag:
                    continue
                parts = tag.split(":")
                slot = ":".join(parts[:2])
                if slot in SLOT_FROM_TAG and len(parts) > 2 and parts[2] in PERSONS:
                    attested[lem][(slot, parts[2])].add(r["ortho"])
                elif slot == "par:pas":
                    attested[lem][("par:pas", "")].add(r["ortho"])
    return attested, freq


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--verb")
    ap.add_argument("--validate", help="path to Lexique383.tsv")
    ap.add_argument("--top", type=int, default=2400)
    ap.add_argument("--show-failures", type=int, default=12)
    args = ap.parse_args()

    if args.verb:
        pattern, forms = conjugate(args.verb)
        print(f"{args.verb}  [{pattern}]")
        if forms:
            print(json.dumps(forms, ensure_ascii=False, indent=2))
        return 0

    if not args.validate:
        ap.print_help()
        return 2

    attested, freq = load_oracle(args.validate)
    if not attested:
        print("refusing: the oracle is empty — nothing to check is a failure, not a pass.",
              file=sys.stderr)
        return 2

    ranked = sorted(freq, key=lambda l: -freq[l])[: args.top]
    stats = collections.Counter()
    checked = mismatched = 0
    clean_verbs, failures = [], []

    for lem in ranked:
        pattern, forms = conjugate(lem)
        if forms is None:
            stats[f"skipped ({pattern})"] += 1
            continue
        stats[f"generated ({pattern})"] += 1
        bad = []
        for (slot, person), real in attested[lem].items():
            if slot == "par:pas":
                ours = set(forms.get("par:pas", []))
                # The corpus lists gender and number variants of the participle;
                # the masculine singular must be among them.
                if ours and not (ours & real):
                    bad.append((slot, person, sorted(ours)[0], sorted(real)[:3]))
                checked += 1
                continue
            idx = PERSONS.index(person)
            ours = forms.get(slot, [None] * 6)[idx]
            checked += 1
            if ours is not None and ours not in real:
                bad.append((slot, person, ours, sorted(real)[:3]))
        if bad:
            mismatched += len(bad)
            failures.append((lem, bad))
        else:
            clean_verbs.append(lem)

    print(f"verbs considered (top {args.top} by frequency): {len(ranked)}")
    for k, n in sorted(stats.items()):
        print(f"  {k}: {n}")
    print()
    print(f"forms checked against the corpus: {checked:,}")
    print(f"  mismatches: {mismatched:,}  ({100 * mismatched / max(checked, 1):.2f}%)")
    print(f"verbs with every attested form correct: {len(clean_verbs):,} of {len(ranked)}")
    print(f"verbs with at least one disagreement:   {len(failures):,}")

    if failures and args.show_failures:
        print("\nfirst disagreements (ours vs corpus):")
        for lem, bad in failures[: args.show_failures]:
            slot, person, ours, real = bad[0]
            print(f"  {lem:<16} {slot}:{person:<3} ours={ours:<18} corpus={', '.join(real)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
