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
    "harceler",   # the corpus attests harcèle, not « harcelle »
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
    """c → ç and g → ge before a and o, so that the sound does not harden.

    The accented forms count: the passé simple « nous mangeâmes » and
    « nous commençâmes » begin with â, and a rule that only looked for a bare
    `a` produced « mangâmes » — a hard g, which is not a French word.
    """
    if not ending:
        return stem
    if ending[0] in "aoâàô":
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
    # The u of -guer and -quer is silent and never the stem vowel: in « légu- »
    # the vowel that changes is the é. The corpus caught léguer, déléguer and
    # reléguer, which must give lègue.
    if body.endswith(("gu", "qu")):
        i = len(body) - 3
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
    # Read, not written — but a learner meets both in any B2 text, and leaving
    # them out means the conjugation page simply has nothing where the passé
    # simple should be.
    out["ind:pas"] = [soften(stem, e) + e for e in
                      ["ai", "as", "a", "âmes", "âtes", "èrent"]]
    out["sub:imp"] = [soften(stem, "a") + e for e in
                      ["asse", "asses", "ât", "assions", "assiez", "assent"]]
    out["imp:pre"] = [out["ind:pre"][1], out["ind:pre"][3], out["ind:pre"][4]]
    return out


def conjugate_ir_regular(lemma: str) -> dict:
    stem = lemma[:-2]
    out = {slot: [stem + e for e in endings] for slot, endings in REGULAR_IR_ENDINGS.items()}
    out["ind:fut"] = [lemma + e for e in FUT_ENDINGS]
    out["cnd:pre"] = [lemma + e for e in CND_ENDINGS]
    out["par:pas"] = [stem + "i"]
    out["par:pre"] = [stem + "issant"]
    out["ind:pas"] = [stem + e for e in ["is", "is", "it", "îmes", "îtes", "irent"]]
    out["sub:imp"] = [stem + e for e in
                      ["isse", "isses", "ît", "issions", "issiez", "issent"]]
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
    if lemma in NOT_IRREGULAR:
        return ("-ir regular", conjugate_ir_regular(lemma))
    irregular = conjugate_irregular(lemma)
    if irregular is not None:
        return ("irregular model", irregular)
    if lemma.endswith("dre") and not lemma.endswith(NOT_REGULAR_DRE):
        return ("-dre regular", conjugate_regular_dre(lemma))
    if lemma in DEFECTIVE:
        return ("defective — refused on purpose", None)
    if lemma in NOT_A_VERB:
        return ("not a verb", None)
    if lemma.endswith("oir"):
        return ("unhandled -oir", None)          # the -oir verbs with no model yet
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


# ── Irregular verbs: the 270 at the head of the frequency list ──────────────

from irregular_models import MODELS, DIRE_IRREGULAR_VOUS, EXACT_ONLY   # noqa: E402

# Verbs that END in an irregular model but do not belong to it.
NOT_IRREGULAR = {"répartir", "assortir", "impartir"}

from conjugation_exceptions import classification, KNOWN_WRONG, DEFECTIVE, NOT_A_VERB   # noqa: E402

IMPARFAIT_ENDINGS = ["ais", "ais", "ait", "ions", "iez", "aient"]
SUBJ_IMP_ENDINGS = ["sse", "sses", "^t", "ssions", "ssiez", "ssent"]


# Endings that look like -dre but are their own families and must not take the
# regular pattern: -indre changes its stem (peignons), -oudre and -soudre are
# irregular, and prendre is prendre.
NOT_REGULAR_DRE = ("aindre", "eindre", "oindre", "oudre", "prendre")


def conjugate_regular_dre(lemma: str) -> dict:
    """attendre, entendre, perdre, répondre, vendre, mordre, fondre…

    The largest single group left after the models: twenty-six of the ninety-one.
    Regular once seen — the third person singular simply has no ending, which is
    why it is « il attend » and not « il attendt ».
    """
    stem = lemma[:-3]                      # attendre → atten
    out = {
        "ind:pre": [stem + "ds", stem + "ds", stem + "d",
                    stem + "dons", stem + "dez", stem + "dent"],
        "ind:imp": [stem + "d" + e for e in IMPARFAIT_ENDINGS],
        "ind:fut": [stem + "dr" + e for e in FUT_ENDINGS],
        "cnd:pre": [stem + "dr" + e for e in CND_ENDINGS],
        "sub:pre": [stem + "de", stem + "des", stem + "de",
                    stem + "dions", stem + "diez", stem + "dent"],
        "ind:pas": [stem + "dis", stem + "dis", stem + "dit",
                    stem + "dîmes", stem + "dîtes", stem + "dirent"],
        "par:pas": [stem + "du"],
        "par:pre": [stem + "dant"],
        "aux": "avoir",
    }
    out["sub:imp"] = [stem + "disse", stem + "disses", stem + "dît",
                      stem + "dissions", stem + "dissiez", stem + "dissent"]
    out["imp:pre"] = [out["ind:pre"][1], out["ind:pre"][3], out["ind:pre"][4]]
    return out


def _model_for(lemma: str):
    """Longest matching family, so comprendre finds prendre and not rendre."""
    if lemma in MODELS:
        return lemma, ""
    best = None
    for name in MODELS:
        if name in EXACT_ONLY:
            continue            # only an exact match, handled above
        if lemma.endswith(name) and (best is None or len(name) > len(best)):
            best = name
    if best is None:
        return None, None
    return best, lemma[: len(lemma) - len(best)]


def _pref(prefix: str, form):
    return None if form is None else prefix + form


def conjugate_irregular(lemma: str) -> dict | None:
    name, prefix = _model_for(lemma)
    if name is None:
        return None
    m = MODELS[name]
    out: dict[str, list] = {}

    pres = [_pref(prefix, f) for f in m["pres"]]
    # Only dire and redire take « vous dites »; interdire, prédire, contredire
    # and médire all take -disez, which is the classic trap.
    if name == "dire" and lemma not in DIRE_IRREGULAR_VOUS and pres[4]:
        pres[4] = prefix + "disez"
    out["ind:pre"] = pres

    ppr = _pref(prefix, m.get("ppr"))
    out["par:pre"] = [ppr] if ppr else []
    if "imparfait" in m:
        out["ind:imp"] = [_pref(prefix, f) for f in m["imparfait"]]
    elif ppr:
        stem = ppr[:-3]
        out["ind:imp"] = [stem + e for e in IMPARFAIT_ENDINGS]
    else:
        out["ind:imp"] = [None] * 6

    fut_stem = prefix + m["fut"]
    out["ind:fut"] = [fut_stem + e for e in FUT_ENDINGS]
    out["cnd:pre"] = [fut_stem + e for e in CND_ENDINGS]

    if "subj" in m:
        out["sub:pre"] = [_pref(prefix, f) for f in m["subj"]]
    else:
        # The rule almost every irregular follows: ils-présent stem for the
        # singular and third plural, nous-imparfait stem for nous and vous.
        ils, nous = pres[5], out["ind:imp"][3]
        if ils and nous:
            a, b = ils[:-3], nous[:-4]
            out["sub:pre"] = [a + "e", a + "es", a + "e", b + "ions", b + "iez", a + "ent"]
        else:
            out["sub:pre"] = [None] * 6

    out["ind:pas"] = [_pref(prefix, f) for f in m["ps"]]
    tu_ps = out["ind:pas"][1]
    if tu_ps:
        base = tu_ps[:-1] if tu_ps.endswith("s") else tu_ps
        out["sub:imp"] = [base + e if e != "^t" else _circumflex(base) + "t"
                          for e in SUBJ_IMP_ENDINGS]
    else:
        out["sub:imp"] = [None] * 6

    out["par:pas"] = [_pref(prefix, m["pp"])]
    out["imp:pre"] = ([_pref(prefix, f) for f in m["imper"]] if "imper" in m
                      else [pres[1], pres[3], pres[4]])
    out["aux"] = m.get("aux", "avoir")
    return out


def _circumflex(base: str) -> str:
    """prit → prît. The third person singular of the imperfect subjunctive."""
    # A vowel that already carries a diacritic does not take a circumflex on
    # top: haïr gives « qu'il haït », not « hâït ». Found by the second oracle.
    if any(ch in base for ch in "ïëüäöî"):
        return base
    last_vowel = max((i for i, ch in enumerate(base) if ch in "aeiouyâêîôûé"), default=-1)
    if last_vowel == -1:
        return base
    swap = {"a": "â", "e": "ê", "i": "î", "o": "ô", "u": "û", "é": "ê"}
    ch = base[last_vowel]
    return base[:last_vowel] + swap.get(ch, ch) + base[last_vowel + 1:]


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


def load_wiktionary(path: str) -> dict:
    """The second oracle: complete paradigms from fr.wiktionary.org (CC BY-SA).

    Lexique is a corpus and attests about 19 of a verb's 45 forms. Wiktionary
    carries the whole table, including the passé simple and the subjonctif
    imparfait — the forms a C-level reader meets and the corpus cannot see.
    """
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)["verbs"]


def cross_check(ranked, wikt, show=12):
    """Compare generated forms against Wiktionary, slot by slot.

    Reports three populations, and the third is the point of the exercise:
      agreed        both oracles, or Wiktionary alone, confirm the form
      disagreed     Wiktionary says something else — a finding, to be judged
      unverified    neither source has an opinion — the remaining blind spot
    """
    agreed = disagreed = 0
    findings = []
    slots_seen = collections.Counter()
    for lem in ranked:
        table = wikt.get(lem)
        if not table:
            continue
        _, forms = conjugate(lem)
        if forms is None:
            continue
        for slot, theirs in table.items():
            ours = forms.get(slot)
            if not ours:
                continue
            slots_seen[slot] += 1
            for i, (a, b) in enumerate(zip(ours, theirs)):
                if a is None or not b:
                    continue
                if a == b:
                    agreed += 1
                else:
                    disagreed += 1
                    findings.append((lem, slot, PERSONS[i], a, b))
    print()
    print(f"second oracle — fr.wiktionary.org, {len(wikt):,} verbs")
    print(f"  forms compared : {agreed + disagreed:,}")
    print(f"  agreed         : {agreed:,}  ({100 * agreed / max(agreed + disagreed, 1):.2f}%)")
    print(f"  disagreed      : {disagreed:,}")
    print("  coverage by slot: " + ", ".join(f"{k} {v}" for k, v in sorted(slots_seen.items())))
    if findings and show:
        print("\n  disagreements with Wiktionary (ours vs theirs):")
        for lem, slot, person, a, b in findings[:show]:
            print(f"    {lem:<16} {slot}:{person:<3} ours={a:<18} wiktionary={b}")
    return findings


def load_fixture(path: str):
    """The committed 150 KiB subset, which is what runs in CI.

    Same shape as `load_oracle`, from `tests/fixtures/lexique-verbs.json.gz`.
    Frequency is not in the subset — it is not needed to check a form — so the
    ranking is simply the file's own order, which was written frequency-first.
    """
    import gzip
    with gzip.open(path, "rt", encoding="utf-8") as fh:
        data = json.load(fh)
    attested: dict[str, dict[tuple[str, str], set[str]]] = collections.defaultdict(
        lambda: collections.defaultdict(set))
    freq: dict[str, float] = {}
    for rank, (lemma, rows) in enumerate(data["verbs"].items()):
        freq[lemma] = float(len(data["verbs"]) - rank)
        for ortho, tags in rows:
            for tag in tags.split(";"):
                parts = tag.split(":")
                slot = ":".join(parts[:2])
                if slot in SLOT_FROM_TAG and len(parts) > 2 and parts[2] in PERSONS:
                    attested[lemma][(slot, parts[2])].add(ortho)
                elif slot == "par:pas":
                    attested[lemma][("par:pas", "")].add(ortho)
    return attested, freq


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--verb")
    ap.add_argument("--validate", help="path to Lexique383.tsv")
    ap.add_argument("--validate-fixture",
                    help="path to the committed gzipped subset (what CI uses)")
    ap.add_argument("--top", type=int, default=2400)
    ap.add_argument("--show-failures", type=int, default=12)
    ap.add_argument("--wiktionary", help="second oracle, from harvest_wiktionary.py")
    args = ap.parse_args()

    if args.verb:
        pattern, forms = conjugate(args.verb)
        print(f"{args.verb}  [{pattern}]")
        if forms:
            print(json.dumps(forms, ensure_ascii=False, indent=2))
        return 0

    if not args.validate and not args.validate_fixture:
        ap.print_help()
        return 2

    if args.validate_fixture:
        attested, freq = load_fixture(args.validate_fixture)
    else:
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
                ours = set(x for x in forms.get("par:pas", []) if x)
                # The corpus lists gender and number variants, and for an
                # essentially-pronominal verb it may list ONLY those: entraidés,
                # dandinée. So the masculine singular is the stem of what the
                # corpus holds, not necessarily a member of it.
                ok = any(r == o or r.startswith(o) for o in ours for r in real)
                if ours and not ok:
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

    # Every disagreement must be classified by hand. An unclassified one is the
    # dangerous case: we do not yet know whether we are wrong or the corpus is.
    buckets = collections.Counter()
    unclassified = []
    for lem, _ in failures:
        kind = classification(lem)
        buckets[kind or "UNCLASSIFIED"] += 1
        if kind is None:
            unclassified.append(lem)
    print()
    print("disagreements, classified:")
    for k in ("corpus-noise", "alternate", "known-wrong", "UNCLASSIFIED"):
        if buckets[k]:
            print(f"  {k:<14} {buckets[k]}")
    shippable = [l for l in clean_verbs if l not in KNOWN_WRONG] + \
                [l for l, _ in failures if classification(l) in ("corpus-noise", "alternate")]
    print()
    print(f"SHIPPABLE: {len(shippable):,} of {len(ranked)} verbs")
    print(f"  withheld as known-wrong: {len([l for l, _ in failures if classification(l) == 'known-wrong'])}")
    print(f"  withheld as unclassified: {len(unclassified)}")
    if unclassified:
        print("  unclassified (each must be judged by hand before shipping):")
        for lem in unclassified[:20]:
            bad = dict(failures)[lem][0]
            print(f"    {lem:<16} {bad[0]}:{bad[1]:<3} ours={bad[2]:<16} corpus={', '.join(bad[3])}")

    if args.wiktionary:
        cross_check(ranked, load_wiktionary(args.wiktionary), args.show_failures)

    if failures and args.show_failures:
        print("\nfirst disagreements (ours vs corpus):")
        for lem, bad in failures[: args.show_failures]:
            slot, person, ours, real = bad[0]
            print(f"  {lem:<16} {slot}:{person:<3} ours={ours:<18} corpus={', '.join(real)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
