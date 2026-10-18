#!/usr/bin/env python3
"""Read which auxiliary each verb takes from the fr.wiktionary pages already cached.

Why this exists. Until 2026-10-18 the auxiliary on every verb was whatever the
conjugator's *model family* said: `être` for the handful of irregular models
that carry it (aller, venir, partir, sortir, mourir, naître, repentir) and
`avoir` for everything else. That is a rule about how verbs are conjugated, and
the auxiliary is not part of how a verb is conjugated — it is a property of the
verb. « arriver » is a regular -er verb, so it was `avoir`, and a learner
opening it was told « j'ai arrivé ». The same rule made « prévenir » `être`
because it ends in -venir (« j'ai prévenu » is right).

Every fr.wiktionary conjugation page states the fact in its first line:

    Conjugaison de arriver, verbe du 1er groupe, conjugué avec l'auxiliaire être.

A verb that takes both has TWO tables, one per auxiliary (« passer »), and a
pronominal table is headed « Conjugaison de se passer » and is always être.
This script records what each page says, per lemma, and nothing else. It does
not decide anything: `scripts/auxiliary_rulings.py` holds the decisions, and the
build refuses where the two cannot be reconciled.

NO NETWORK. It reads the cache `harvest_wiktionary.py` already filled
(~/.cache/flw/wiktionary-conjugations, see data/README.md) and writes
`data/auxiliaries.json`, which is committed so that content/ can be rebuilt
without the 182 MiB cache.

    python3 scripts/harvest_auxiliaries.py \\
        --verbs data/verb-frequency-list.txt \\
        --cache ~/.cache/flw/wiktionary-conjugations \\
        --out data/auxiliaries.json

Source: fr.wiktionary.org, CC BY-SA 4.0, attributed in content/attribution.json.
"""
from __future__ import annotations

import argparse
import html
import json
import pathlib
import re
import sys
import urllib.parse

# Python's str regexes are Unicode-aware, so « être » matches here. The JavaScript
# twin of this check (tests/auxiliary.test.js) is NOT: its \b treats ê as a
# non-word character, and /\bêtre\b/ silently matches nothing.
TABLE = re.compile(
    r"Conjugaison de\s+(se\s+|s[’']\s*)?(\S+?)\s*,\s*verbe([^.]*?)"
    r"conjugué avec l[’']auxiliaire\s+(avoir|être)")


def read_page(path: pathlib.Path) -> dict | None:
    if not path.exists():
        return None
    raw = path.read_text(encoding="utf-8")
    if not raw:
        return {"page": False, "plain": [], "reflexive": []}
    text = html.unescape(re.sub(r"<[^>]+>", " ", raw))
    text = re.sub(r"[\s\xa0]+", " ", text)
    plain, reflexive = set(), set()
    for m in TABLE.finditer(text):
        (reflexive if m.group(1) else plain).add(m.group(4))
    return {"page": True, "plain": sorted(plain), "reflexive": sorted(reflexive)}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--verbs", required=True)
    ap.add_argument("--cache", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--read", required=True,
                    help="the date the cached pages were fetched, YYYY-MM-DD "
                         "(a figure read from a source carries the date it was read)")
    args = ap.parse_args()

    verbs = [v.strip() for v in pathlib.Path(args.verbs).read_text(encoding="utf-8").splitlines()
             if v.strip()]
    cache = pathlib.Path(args.cache).expanduser()
    out, missing = {}, []
    for v in verbs:
        got = read_page(cache / f"{urllib.parse.quote(v, safe='')}.html")
        if got is None:
            missing.append(v)
            continue
        out[v] = got
    if missing:
        print(f"refusing: {len(missing)} verbs have no cached page, e.g. {missing[:5]}. "
              "Run harvest_wiktionary.py first; an incomplete harvest is not a result.",
              file=sys.stderr)
        return 2
    if len(out) < 2000:
        print("refusing: far too few verbs to be the real list.", file=sys.stderr)
        return 2

    pathlib.Path(args.out).write_text(json.dumps({
        "version": 1,
        "source": "fr.wiktionary.org, « Conjugaison:français/<verbe> », line "
                  "« conjugué avec l'auxiliaire … »",
        "licence": "CC BY-SA 4.0 — see content/attribution.json",
        "read": args.read,
        "note": "What the page SAYS, not what is true. plain = auxiliaries named "
                "by the non-pronominal tables (two entries: the verb has a table "
                "for each); reflexive = auxiliaries named by « se … » tables. "
                "page=false: fr.wiktionary has no conjugation page, and nothing "
                "is known from it. The decisions are in scripts/auxiliary_rulings.py.",
        "verbs": out,
    }, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n", encoding="utf-8")
    both = sum(1 for e in out.values() if len(e["plain"]) == 2)
    print(f"read {len(out)} verbs; {both} name both auxiliaries; "
          f"{sum(1 for e in out.values() if not e['plain'] and not e['reflexive'])} name none")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
