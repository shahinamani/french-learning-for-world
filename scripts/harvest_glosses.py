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

What is taken: the sense lines of the French Verb section, in order, trimmed to
the first few. Not the etymology, not the usage notes, not the quotations —
those are long, and a learner meeting a verb needs "to take", not an essay.

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
MAX_SENSES = 3


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


def clean(line: str) -> str:
    """Wikitext sense line to plain English."""
    s = line
    s = re.sub(r"\{\{(?:lb|label|tlb)\|[^}]*\}\}", "", s)          # (transitive) labels
    s = re.sub(r"\{\{(?:g|gloss|q|qualifier|n-g|non-gloss definition)\|([^}|]*)[^}]*\}\}",
               r"\1", s)
    s = re.sub(r"\{\{[^}]*\}\}", "", s)                             # any other template
    s = re.sub(r"\[\[([^\]|]*)\|([^\]]*)\]\]", r"\2", s)            # [[a|b]] -> b
    s = re.sub(r"\[\[([^\]]*)\]\]", r"\1", s)                       # [[a]] -> a
    s = re.sub(r"'''?", "", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = re.sub(r"[{}]+", "", s)          # stray braces from a template we did not match
    s = re.sub(r"\s+", " ", s).strip(" ,;:")
    return s.strip()


def senses(wikitext: str) -> list[str]:
    """The French Verb section's sense lines, in order."""
    # The French section runs to the next language heading at the same level.
    # `(?:^|\n)`, not `\n`: on many pages French is the FIRST language and the
    # heading sits at offset zero with nothing before it. Requiring a preceding
    # newline made the section invisible for exactly those — attendre and
    # vouloir among them — and the harvest reported "no French verb sense found"
    # rather than "my anchor assumed this is never first".
    m = re.search(r"(?:^|\n)==\s*French\s*==\n(.*?)(?=\n==[^=]|\Z)", wikitext, re.S)
    if not m:
        return []
    french = m.group(1)
    # Verb sits at ===Verb=== (or ====Verb==== under an Etymology split), and the
    # section ends at the NEXT heading of any depth — « Usage notes » and
    # « Conjugation » are deeper, so a terminator that only looked for the same
    # depth swallowed them and everything after.
    v = re.search(r"(?:^|\n)(=+)\s*Verb\s*\1\s*\n(.*?)(?=\n=+\s*[A-Z][^=\n]*\s*=+|\Z)",
                  french, re.S)
    if not v:
        return []
    out: list[str] = []
    for line in v.group(2).split("\n"):
        if not line.startswith("# ") or line.startswith("#*") or line.startswith("#:"):
            continue
        s = clean(line[2:])
        if not s or len(s) >= 120:
            continue
        # Wiktionary repeats a sense under several labels, so « to eat · to eat »
        # is common; and a non-gloss definition explains the word rather than
        # translating it, which is not what a flashcard wants.
        if s.lower() in (x.lower() for x in out):
            continue
        if re.match(r"(?i)(used |with the meaning|forms? a |indicates? )", s):
            continue
        out.append(s)
        if len(out) >= MAX_SENSES:
            break
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--verbs", required=True)
    ap.add_argument("--cache", default=".gloss-cache")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    cache = pathlib.Path(args.cache)
    cache.mkdir(exist_ok=True)
    verbs = [l.strip() for l in pathlib.Path(args.verbs).read_text(encoding="utf-8").splitlines() if l.strip()]
    if not verbs:
        print("refusing: no verbs given.", file=sys.stderr)
        return 2

    got, none_found, failed = {}, [], []
    for i, v in enumerate(verbs, 1):
        try:
            page = fetch(v, cache)
        except FetchFailed as e:
            failed.append(str(e))
            continue
        if page is None:
            none_found.append(v)
            continue
        s = senses(page)
        if s:
            got[v] = s
        else:
            none_found.append(v)
        if i % 100 == 0:
            print(f"  {i}/{len(verbs)} — {len(got)} with a gloss", file=sys.stderr)

    pathlib.Path(args.out).write_text(json.dumps(
        {"source": "en.wiktionary.org", "licence": "CC BY-SA 4.0", "glosses": got},
        ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"glossed {len(got)} of {len(verbs)} verbs")
    if none_found:
        print(f"  no French verb sense found: {len(none_found)} — {', '.join(none_found[:8])}")
    if failed:
        print(f"\n  FETCH FAILURES: {len(failed)} — the harvest is incomplete", file=sys.stderr)
        for line in failed[:8]:
            print(f"    {line}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
