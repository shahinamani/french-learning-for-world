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
stripped, and a sense carrying one of `REJECT` never reaches a learner. This is
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

# A sense carrying any of these is not shown to a learner. Wiktionary's own
# label names, lowercased. `slur` and `offensive` are here beyond what was asked
# for: shipping an ethnic slur as vocabulary is the same failure as shipping
# « venir » as "to orgasm", and it would be strange to guard one and not the
# other.
REJECT = frozenset({
    "vulgar", "vulgarity", "obscene", "profanity", "coarse",
    "offensive", "derogatory", "slur", "ethnic slur", "racial slur",
})

# Kept, and shown in parentheses so the learner knows the register. Dropping
# these would lose « bosser » (to work) and « bouffer » (to eat), which are
# ordinary spoken French, and would teach a learner less rather than protecting
# them from anything.
REGISTER = ("slang", "informal", "colloquial", "familiar",
            "dated", "archaic", "literary", "formal", "childish")


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


def senses(wikitext: str) -> tuple[list[str], list[dict]]:
    """The French Verb section's first MAX_SENSES usable senses.

    Returns the senses and a record of every sense rejected and why, so the
    harvest can report what it withheld instead of silently thinning the data.
    """
    # The French section runs to the next language heading at the same level.
    # `(?:^|\n)`, not `\n`: on many pages French is the FIRST language and the
    # heading sits at offset zero with nothing before it. Requiring a preceding
    # newline made the section invisible for exactly those — attendre and
    # vouloir among them — and the harvest reported "no French verb sense found"
    # rather than "my anchor assumed this is never first".
    m = re.search(r"(?:^|\n)==\s*French\s*==\n(.*?)(?=\n==[^=]|\Z)", wikitext, re.S)
    if not m:
        return [], []
    french = m.group(1)
    # Verb sits at ===Verb=== (or ====Verb==== under an Etymology split), and the
    # section ends at the NEXT heading of any depth — « Usage notes » and
    # « Conjugation » are deeper, so a terminator that only looked for the same
    # depth swallowed them and everything after.
    v = re.search(r"(?:^|\n)(=+)\s*Verb\s*\1\s*\n(.*?)(?=\n=+\s*[A-Z][^=\n]*\s*=+|\Z)",
                  french, re.S)
    if not v:
        return [], []
    # Before any line is read. An editor's aside can open on one sense line and
    # close on the next, and `<[^>]+>` matches neither half — which is how
    # « chier » shipped "not sure I believe the next one" as its meaning.
    body = re.sub(r"<!--.*?-->", "", v.group(2), flags=re.S)
    body = re.sub(r"<!--.*\Z", "", body, flags=re.S)   # a comment left unclosed

    out: list[str] = []
    rejected: list[dict] = []
    for line in body.split("\n"):
        if not line.startswith("# ") or line.startswith("#*") or line.startswith("#:"):
            continue
        labels = labels_of(line)
        bad = sorted(set(labels) & REJECT)
        s_text = clean(line[2:])
        if bad:
            rejected.append({"why": "label", "labels": bad, "text": s_text[:90]})
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
        out.append(s_text)
        if len(out) >= MAX_SENSES:
            break
    return out, rejected


def probe(path: str) -> int:
    """Run the parser over one wikitext file and print what it decided, as JSON.

    This is what the automated check drives: a fixture in, a verdict out. The
    label filter is only worth having if something fails when it is removed, and
    a test that can read `rejected` can assert exactly that.
    """
    text = pathlib.Path(path).read_text(encoding="utf-8")
    kept, rejected = senses(text)
    print(json.dumps({"kept": kept, "rejected": rejected},
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
    for i, v in enumerate(verbs, 1):
        try:
            page = fetch(v, cache)
        except FetchFailed as e:
            failed.append(str(e))
            continue
        if page is None:
            none_found.append(v)
            continue
        s, rejected = senses(page)
        if rejected:
            all_rejected[v] = rejected
        if s:
            got[v] = s
        else:
            none_found.append(v)
            if any(r["why"] == "label" for r in rejected):
                silenced.append(v)
        if i % 200 == 0:
            print(f"  {i}/{len(verbs)} — {len(got)} with a gloss", file=sys.stderr)

    by_label: dict[str, int] = {}
    for rs in all_rejected.values():
        for r in rs:
            for l in r.get("labels", []):
                if r["why"] == "label":
                    by_label[l] = by_label.get(l, 0) + 1

    pathlib.Path(args.out).write_text(json.dumps({
        "source": "en.wiktionary.org",
        "licence": "CC BY-SA 4.0",
        "maxSenses": MAX_SENSES,
        "rejectedLabels": sorted(REJECT),
        "sensesRejectedByLabel": dict(sorted(by_label.items(), key=lambda kv: -kv[1])),
        "withheldEntirely": sorted(silenced),
        "glosses": got,
    }, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    print(f"glossed {len(got)} of {len(verbs)} verbs (at most {MAX_SENSES} senses each)")
    dropped = sum(n for n in by_label.values())
    print(f"  senses dropped by label: {dropped} — "
          + ", ".join(f"{l} {n}" for l, n in sorted(by_label.items(), key=lambda kv: -kv[1])[:8]))
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
