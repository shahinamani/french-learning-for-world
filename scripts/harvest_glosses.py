#!/usr/bin/env python3
"""English glosses for French verbs, from the English Wiktionary (CC BY-SA 4.0).

The conjugation harvest reads `fr.wiktionary.org/wiki/Conjugaison:français/<v>`,
which is a table of forms and carries no meaning at all — checked rather than
assumed. Meanings live on the **English** Wiktionary, whose French entries give
English definitions, and which is a different wiki under the same licence.

Why this matters for the product: 2,392 verbs with complete paradigms and no
meanings are a conjugation reference. With a gloss they are flashcards. The
difference is one short phrase per verb, and it is the difference between a
lookup tool and something a learner studies.

What is taken: the first two sense lines of the French Verb section. Not the
etymology, not the usage notes, not the quotations — those are long, and a
learner meeting a verb needs "to take", not an essay.

**What is dropped, and how.** Wiktionary labels its senses itself:
`{{lb|fr|Anglicism|vulgar}}`. Those labels are read BEFORE the templates are
stripped, so the register can be SHOWN. What is refused is decided on our own
English output instead — see `EXPLICIT`. This is
not a word blocklist: a blocklist both misses what it has not heard of and
censors the innocent (« baiser » means "to kiss", and its vulgar senses are
labelled as such — one word, two registers, and only the label can tell them
apart). `venir` is the case that matters: its third sense is
`{{lb|fr|Anglicism|vulgar}} to cum, to come, to orgasm`, and it was shipping to
learners on a verb every A1 course teaches in week one.

A label in `REGISTER` is kept and shown — « bosser » is slang and is also how
half of France says "to work", so dropping it would teach less, not more. The
register is appended so the learner knows: `to work (slang)`.

Three parsing faults were found while this was written, all of them visible in
the shipped content:

  * An HTML comment that spans two lines is not matched by `<[^>]+>`, so
    `chier` shipped a Wiktionary editor's aside — "not sure I believe the next
    one" — as part of its meaning. Comments are now stripped from the whole
    section before any line is read.
  * Templates nest, and a single non-recursive pattern cannot see that.
    `{{ng|... {{m|en|would}}
    or {{m|en|should}} ...}}` was stripped as two separate matches, leaving the
    text between them: `vouloir` shipped a sense whose entire content was the
    word "or". Templates are now removed innermost-first, repeatedly.
  * `{{gloss|...}}` was inlined bare, so `venir` read "to come to move from one
    place to another that is nearer the speaker" — two clauses welded into one
    sentence that means something else. A gloss is now parenthesised.

Usage:
    python3 scripts/harvest_glosses.py --verbs list.txt --out glosses.json
"""
from __future__ import annotations

import argparse
import json
import pathlib
import re
import subprocess
import sys
import time
import urllib.parse

UA = ("french-learning-for-world/0.1 (open-source CC BY-SA French learning "
      "project; https://github.com/shahinamani/french-learning-for-world)")
API = "https://en.wiktionary.org/w/api.php"
# Two, not three. A flashcard is read in a second; the third sense of « avoir »
# is true and is not what somebody meeting the verb needs.
MAX_SENSES = 2

# **The line is drawn on OUR English output, not on Wiktionary's French label.**
#
# The first version of this filter dropped any sense Wiktionary labelled vulgar.
# That was the wrong question. `vulgar` describes the register of the FRENCH
# word; it says nothing about the English we are about to print. It cost:
#
#   gueuler    "to yell, to scream"    — clean English, coarse French
#   démerder   "to manage, to get by"  — the same
#
# A learner needs both halves: that « gueuler » means "to yell" AND that it is
# coarse. Hiding it teaches nothing and leaves them able to use it in a DELF
# oral without knowing what they have said. So the register is now shown and the
# meaning is kept, and the only thing refused is English we would not print.
#
# **« baiser » is the case that proves this rule rather than an exception to it.**
# It comes out as "to kiss (dated); to prevail over someone, screw (vulgar)",
# and both halves must stay. In modern French « baiser » almost never means "to
# kiss" — « embrasser » does — so a learner who reads only "to kiss (dated)"
# will use it in a classroom and find out the hard way. The vulgar sense, with
# its label, is the thing that protects them. Show the meaning, show the
# register, let the learner decide. Do not "tidy" the second sense away.
#
# A word list is defensible here in a way it was not before, because it is
# applied to the sentence we are about to publish rather than to somebody else's
# language. These are terms with no innocent reading in a verb gloss. Terms with
# one are deliberately absent: "screw" (visser is "to screw"), "prick" (piquer
# is "to prick"), "cock" (one cocks a weapon), "bitch" (one bitches about
# something), "ass" (the animal).
EXPLICIT = re.compile(r"""(?ix) \b(
      fuck\w*  | cum | cumming | orgasm\w* | jizz
    | shit\w* | defecat\w* | piss\w*
    | wank\w* | jerk \s off | jack \s off | masturbat\w*
    | bugger\w* | sodomi\w* | anal \s sex | blow ?job
    | cunt\w* | twat\w* | dick | dicking
    | arse\w* | ass ?hole\w*
    | whore\w* | slut\w* | nigger\w* | faggot\w*
    | penis | vagina | anus | testicle\w*
)\b""")

# Two, not three. A flashcard is read in a second; the third sense of « avoir »
# is true and is not what somebody meeting the verb needs.
MAX_SENSES = 2

# Shown in parentheses so the learner knows the register. `vulgar` is here
# rather than in a reject list on purpose — see EXPLICIT above.
REGISTER = ("vulgar", "slang", "informal", "colloquial", "familiar",
            "dated", "archaic", "literary", "formal", "childish",
            "derogatory", "offensive")

# Wiktionary's own marks for a verb that exists only with a reflexive pronoun.
PRONOMINAL = frozenset({"pronominal", "reflexive"})

# A label LIST is a DISJUNCTION. `{{lb|fr|transitive|or|pronominal}}` on
# « transporter » says transitive OR pronominal, and reading it as "pronominal"
# put transporter among the pronominal-only verbs — which would have taught a
# learner that « se transporter » is the only form of "to transport". Any of
# these on a sense means the verb has a non-pronominal use.
NON_PRONOMINAL = frozenset({"transitive", "intransitive", "ambitransitive",
                            "impersonal"})

class FetchFailed(Exception):
    """Transport or API failure — NOT the same as 'this verb has no entry'."""


def fetch(verb: str, cache: pathlib.Path) -> str | None:
    f = cache / f"{urllib.parse.quote(verb, safe='')}.wiki"
    if f.exists():
        return f.read_text(encoding="utf-8") or None
    params = urllib.parse.urlencode({
        "action": "parse", "page": verb, "prop": "wikitext",
        "format": "json", "formatversion": "2", "maxlag": "5",
    })
    try:
        out = subprocess.run(
            ["curl", "-sS", "--fail-with-body", "--max-time", "60", "-A", UA,
             f"{API}?{params}"],
            capture_output=True, text=True, check=True).stdout
    except subprocess.CalledProcessError as e:
        raise FetchFailed(f"{verb}: curl failed — {e.stderr.strip()[:100]}") from e
    try:
        d = json.loads(out)
    except json.JSONDecodeError as e:
        raise FetchFailed(f"{verb}: response was not JSON") from e
    if "error" in d:
        if d["error"].get("code") in ("missingtitle", "nosuchpageid"):
            f.write_text("", encoding="utf-8")
            return None
        raise FetchFailed(f"{verb}: API error {d['error'].get('code')}")
    text = d["parse"]["wikitext"]
    f.write_text(text, encoding="utf-8")
    time.sleep(0.34)
    return text


def labels_of(line: str) -> list[str]:
    """Wiktionary's own labels for this sense, read before anything is stripped.

    `{{lb|fr|transitive|vulgar}}` -> ["transitive", "vulgar"]. The language code
    and `_` (the template's own word-joiner) are not labels.
    """
    out: list[str] = []
    for m in re.finditer(r"\{\{(?:lb|label|tlb)\|([^{}]*)\}\}", line):
        for part in m.group(1).split("|"):
            part = part.strip().lower()
            if part and part not in ("fr", "_"):
                out.append(part)
    return out


def strip_templates(s: str) -> str:
    """Remove `{{...}}` innermost-first until none is left.

    One non-recursive pass cannot do this: templates nest, and on a nested
    one it matches from the outer `{{` to the FIRST `}}`, which ends inside the
    inner template and leaves the text after it behind. That is how `vouloir`
    came to ship a sense consisting of the word "or".
    """
    while True:
        new = re.sub(r"\{\{[^{}]*\}\}", "", s)
        if new == s:
            return s
        s = new


def clean(line: str) -> str:
    """Wikitext sense line to plain English."""
    s = line
    # A gloss or qualifier clarifies the translation beside it; inlined bare it
    # welds two clauses into one false sentence, so it is parenthesised.
    s = re.sub(r"\{\{(?:g|gloss|q|qualifier)\|([^{}|]*)[^{}]*\}\}", r"(\1)", s)
    s = re.sub(r"\{\{(?:lb|label|tlb)\|[^{}]*\}\}", "", s)       # labels: read already
    s = re.sub(r"\{\{(?:l|m|w)\|[^{}|]*\|([^{}|]*)[^{}]*\}\}", r"\1", s)  # {{l|en|please}}
    s = strip_templates(s)
    s = re.sub(r"\[\[([^\]|]*)\|([^\]]*)\]\]", r"\2", s)            # [[a|b]] -> b
    s = re.sub(r"\[\[([^\]]*)\]\]", r"\1", s)                       # [[a]] -> a
    s = re.sub(r"\'\'\'?", "", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = re.sub(r"[{}]+", "", s)          # stray braces from a template we did not match
    s = re.sub(r"\(\s*\)", "", s)         # a parenthetical emptied by the above
    s = re.sub(r"\s+([,;:)])", r"\1", s)
    s = re.sub(r"\s+", " ", s).strip(" ,;:")
    return s.strip()


# A line that survived cleaning but says nothing a learner can use. Seen in the
# shipped content rather than imagined: "or" (vouloir), left behind between two
# nested templates.
def split_parts(text: str) -> list[str]:
    """A sense's alternative translations, split on the separators OUTSIDE
    parentheses.

    A Wiktionary sense is usually a list of synonyms — "to shaft, to fuck over,
    dupe, swindle, fool" — and refusing the whole sense for one of them costs
    « entuber » its four printable translations. Splitting at depth zero keeps
    "to put on/in (quickly), to shove" in one piece.
    """
    parts, depth, cur = [], 0, []
    for ch in text:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        if ch in ",;" and depth == 0:
            parts.append("".join(cur)); cur = []
            continue
        cur.append(ch)
    parts.append("".join(cur))
    return [p.strip() for p in parts if p.strip()]


def without_explicit(text: str) -> tuple[str, int]:
    """The sense with its unprintable alternatives removed, and how many went.

    Returns ("", n) when every alternative was explicit, which is how
    « chier » and « enculer » end up with no gloss: not because the French is
    coarse, but because every English translation of them is.
    """
    parts = split_parts(text)
    if not parts:
        return "", 0
    # If the LEADING translation is unprintable, the whole sense goes. Keeping
    # the tail promotes a marginal synonym to be the meaning of the word:
    # « enculer » came back as "to con (defraud)", which is listed, is not what
    # the verb means, and would have left a learner with a confident wrong idea
    # of it. Dropping a trailing synonym is editing a list; dropping the first
    # one and keeping the rest is rewriting the entry.
    if EXPLICIT.search(parts[0]):
        return "", len(parts)
    keep = [p for p in parts if not EXPLICIT.search(p)]
    return ", ".join(keep), len(parts) - len(keep)


NOT_A_MEANING = re.compile(r"(?i)^(or|and|also|see|etc\.?|\(.*\))$")


def usable(s: str) -> bool:
    if not s or len(s) >= 120:
        return False
    if NOT_A_MEANING.match(s):
        return False
    if "<!--" in s or "-->" in s or "{{" in s or "}}" in s:
        return False     # wikitext reached the end of the pipeline; do not ship it
    # A gloss must contain a word. NOT "a word of three letters or more": the
    # first version of this rule required `[A-Za-z]{3}` and silently rejected
    # « aller »'s primary sense, "to go", which has no three-letter word in it.
    # aller would have shipped with "to attend (school, church regularly)" as
    # its first meaning, on the single most taught verb in the language.
    return bool(re.search(r"[A-Za-z]{2}", s))


def pronominal_only(sense_lines: list[str]) -> bool:
    """True when EVERY usable sense needs a reflexive pronoun.

    « souvenir » was glossed "to remember" and a learner reading that writes
    *« je souviens »*, which is not French. The verb exists only as
    « se souvenir ». Nothing in the content marked that, so the conjugation
    table taught the wrong form on every row — the teaching-something-false
    failure this project is built to not have.

    The test is "every sense", not "any sense": roughly five hundred verbs have
    a pronominal sense among others (« trouver » / « se trouver ») and their
    headword is correctly the bare infinitive.
    """
    if not sense_lines:
        return False
    for line in sense_lines:
        got = set(labels_of(line))
        if not (got & PRONOMINAL) or (got & NON_PRONOMINAL):
            return False
    return True


# Before a vowel the pronoun elides: « s'évanouir », not « se évanouir ». No
# verb in the pronominal-only set begins with an h, which matters because
# « h aspiré » does NOT elide (on « se hâter » the pronoun stays « se ») and
# this rule cannot tell the two h's apart. A check asserts the set stays
# h-free, so the day one appears the build says so instead of guessing.
VOWEL = tuple("aáàâäeéèêëiíìîïoóòôöuúùûüy")


def headword(lemma: str) -> str:
    """« souvenir » -> « se souvenir »; « évanouir » -> « s'évanouir »."""
    return ("s'" if lemma[:1].lower() in VOWEL else "se ") + lemma


def senses(wikitext: str) -> tuple[list[str], list[dict], bool]:
    """The French Verb section's first MAX_SENSES usable senses.

    Returns the senses, a record of every sense rejected and why, and whether
    the verb is pronominal-only — so the harvest can report what it withheld
    instead of silently thinning the data.
    """
    # The French section runs to the next language heading at the same level.
    # `(?:^|\n)`, not `\n`: on many pages French is the FIRST language and the
    # heading sits at offset zero with nothing before it. Requiring a preceding
    # newline made the section invisible for exactly those — attendre and
    # vouloir among them — and the harvest reported "no French verb sense found"
    # rather than "my anchor assumed this is never first".
    m = re.search(r"(?:^|\n)==\s*French\s*==\n(.*?)(?=\n==[^=]|\Z)", wikitext, re.S)
    if not m:
        return [], [], False
    french = m.group(1)
    # Verb sits at ===Verb=== (or ====Verb==== under an Etymology split), and the
    # section ends at the NEXT heading of any depth — « Usage notes » and
    # « Conjugation » are deeper, so a terminator that only looked for the same
    # depth swallowed them and everything after.
    v = re.search(r"(?:^|\n)(=+)\s*Verb\s*\1\s*\n(.*?)(?=\n=+\s*[A-Z][^=\n]*\s*=+|\Z)",
                  french, re.S)
    if not v:
        return [], [], False
    # Before any line is read. An editor's aside can open on one sense line and
    # close on the next, and `<[^>]+>` matches neither half — which is how
    # « chier » shipped "not sure I believe the next one" as its meaning.
    body = re.sub(r"<!--.*?-->", "", v.group(2), flags=re.S)
    body = re.sub(r"<!--.*\Z", "", body, flags=re.S)   # a comment left unclosed

    out: list[str] = []
    rejected: list[dict] = []
    # Whether the verb's FIRST sense — its primary meaning — was unprintable.
    # If it was, the verb is silenced rather than represented by a later one:
    # « enculer » came back as "to beat up", which is sense four, is listed, and
    # is not what the word means. Keeping a later sense when the first is
    # refused does not describe the verb, it substitutes a different one.
    first_refused = False
    decided_first = False
    # Every sense line that survives cleaning, whether or not it is among the
    # two kept: the pronominal question is about the VERB, so it must look at
    # all of them. Reading only the kept two would call « transporter »
    # pronominal-only whenever its transitive sense fell outside the cap.
    considered: list[str] = []
    for line in body.split("\n"):
        if not line.startswith("# ") or line.startswith("#*") or line.startswith("#:"):
            continue
        labels = labels_of(line)
        s_text = clean(line[2:])
        if usable(s_text):
            considered.append(line)
        # The decision is made on the English we are about to print. An
        # alternative we would not publish is removed; the rest of the sense
        # survives, so « entuber » keeps "to shaft, dupe, swindle, fool" and
        # only loses one of its five synonyms.
        s_text, dropped_parts = without_explicit(s_text)
        if dropped_parts and not s_text:
            rejected.append({"why": "explicit", "labels": labels,
                             "text": f"all {dropped_parts} alternatives"})
            if not decided_first:
                first_refused, decided_first = True, True
            continue
        if not usable(s_text):

            rejected.append({"why": "unusable", "labels": labels, "text": s_text[:90]})
            continue
        # Wiktionary repeats a sense under several labels, so « to eat · to eat »
        # is common; and a non-gloss definition explains the word rather than
        # translating it, which is not what a flashcard wants.
        if s_text.lower() in (x.lower() for x in out):
            continue
        if re.match(r"(?i)(used |with the meaning|forms? a |indicates? )", s_text):
            rejected.append({"why": "non-gloss", "labels": labels, "text": s_text[:90]})
            continue
        # « bosser » is slang and is also how half of France says "to work". The
        # register is information a learner wants, not a reason to withhold.
        reg = [l for l in labels if l in REGISTER]
        if reg and not re.search(r"\(" + re.escape(reg[0]) + r"\)", s_text):
            s_text = f"{s_text} ({reg[0]})"
        decided_first = True
        out.append(s_text)
        # NOT `break`: the loop must keep reading lines so `considered` holds
        # every sense, not only the first two. Breaking here is what made
        # « transporter » look pronominal-only.
    if first_refused:
        return [], rejected, pronominal_only(considered)
    return out[:MAX_SENSES], rejected, pronominal_only(considered)


def probe(path: str) -> int:
    """Run the parser over one wikitext file and print what it decided, as JSON.

    This is what the automated check drives: a fixture in, a verdict out. The
    label filter is only worth having if something fails when it is removed, and
    a test that can read `rejected` can assert exactly that.
    """
    text = pathlib.Path(path).read_text(encoding="utf-8")
    kept, rejected, pron = senses(text)
    print(json.dumps({"kept": kept, "rejected": rejected,
                      "pronominalOnly": pron},
                     ensure_ascii=False, indent=1))
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--verbs")
    ap.add_argument("--cache", default=".gloss-cache")
    ap.add_argument("--out")
    ap.add_argument("--probe", help="parse one wikitext file and print the verdict")
    args = ap.parse_args()

    if args.probe:
        return probe(args.probe)
    if not args.verbs or not args.out:
        print("refusing: --verbs and --out are required.", file=sys.stderr)
        return 2

    cache = pathlib.Path(args.cache)
    cache.mkdir(exist_ok=True)
    verbs = [l.strip() for l in pathlib.Path(args.verbs).read_text(encoding="utf-8").splitlines() if l.strip()]
    if not verbs:
        print("refusing: no verbs given.", file=sys.stderr)
        return 2

    got, none_found, failed = {}, [], []
    # Why a verb ships without a meaning is reported, not left to be guessed at:
    # a verb every one of whose senses is labelled vulgar is a deliberate
    # withholding, and a verb Wiktionary has no entry for is a gap.
    all_rejected: dict[str, list[dict]] = {}
    silenced: list[str] = []
    # Verbs that exist only with a reflexive pronoun. « se souvenir », not
    # « souvenir »: a learner shown the bare infinitive writes « je souviens ».
    pronominal: list[str] = []
    for i, v in enumerate(verbs, 1):
        try:
            page = fetch(v, cache)
        except FetchFailed as e:
            failed.append(str(e))
            continue
        if page is None:
            none_found.append(v)
            continue
        s, rejected, pron = senses(page)
        if pron:
            pronominal.append(v)
        if rejected:
            all_rejected[v] = rejected
        if s:
            got[v] = s
        else:
            none_found.append(v)
            if any(r["why"] == "explicit" for r in rejected):
                silenced.append(v)
        if i % 200 == 0:
            print(f"  {i}/{len(verbs)} — {len(got)} with a gloss", file=sys.stderr)

    by_label: dict[str, int] = {}
    for rs in all_rejected.values():
        for r in rs:
            for l in r.get("labels", []):
                if r["why"] == "explicit":
                    by_label[l] = by_label.get(l, 0) + 1

    pathlib.Path(args.out).write_text(json.dumps({
        "source": "en.wiktionary.org",
        "licence": "CC BY-SA 4.0",
        "maxSenses": MAX_SENSES,
        "rejectedBy": "explicit terms in the English output, not Wiktionary labels",
        "sensesRejectedByLabel": dict(sorted(by_label.items(), key=lambda kv: -kv[1])),
        "withheldEntirely": sorted(silenced),
        "pronominalOnly": sorted(pronominal),
        "glosses": got,
    }, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    print(f"glossed {len(got)} of {len(verbs)} verbs (at most {MAX_SENSES} senses each)")
    dropped = sum(n for n in by_label.values())
    print(f"  senses refused for explicit English: {dropped} — "
          + ", ".join(f"{l} {n}" for l, n in sorted(by_label.items(), key=lambda kv: -kv[1])[:8]))
    print(f"  pronominal-only (headword is « se X »): {len(pronominal)}")
    if silenced:
        print(f"  verbs left with NO gloss because every sense was rejected: "
              f"{len(silenced)} — {', '.join(silenced)}")
    if none_found:
        print(f"  no usable French verb sense: {len(none_found)}")
    if failed:
        print(f"\n  FETCH FAILURES: {len(failed)} — the harvest is incomplete", file=sys.stderr)
        for line in failed[:8]:
            print(f"    {line}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
