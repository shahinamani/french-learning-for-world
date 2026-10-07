#!/usr/bin/env python3
"""Spread each paper's correct answers evenly across the option positions.

**It refuses to touch any item that carries a review verdict**, and names them.
Moving the answer on an approved item attaches that approval to something the
reviewer did not approve. Nobody would see it happen.

Batch one was drafted with the correct option written first in every item —
the convenient way to write them — and all twenty answers landed at position 0.
A learner who always picked the first option would have scored 20/20.

The guard that caught it then found the same fault in two papers nobody had
looked at: `delf-a1-ce` had five of eight answers at position 2, and the first
eight B2 items had five of eight at position 1. Neither was deliberate; both
came from writing items in a habit.

This rotates each item's options so the answer lands at a position chosen by
round-robin. Deterministic, so the content is reproducible, and it only ever
reorders options — the answer index follows the option it belongs to.
"""
from __future__ import annotations

import json
import pathlib
import sys
from collections import Counter

ROOT = pathlib.Path(__file__).resolve().parent.parent


def main() -> int:
    p = ROOT / "content/exam-papers.json"
    d = json.loads(p.read_text(encoding="utf-8"))
    # **Refuse to touch anything a person has ruled on.** Moving the answer on an
    # approved item attaches that approval to something the reviewer did not
    # approve — the forged-review fault arriving by a different road, and by a
    # road nobody would see. If a reviewed item genuinely needs rebalancing it
    # should cost a re-review, not a silent rewrite.
    reviewed = [it["id"] for paper in d["papers"] for it in paper["items"]
                if (it.get("review") or {}).get("state") in ("approved", "rejected")]
    would_move = []
    for paper in d["papers"]:
        for n, item in enumerate(paper["items"]):
            if len(item["options"]) < 2 or item["answer"] == n % len(item["options"]):
                continue
            if item["id"] in reviewed:
                would_move.append(f'{item["id"]} ({item["review"]["state"]} '
                                  f'by {item["review"]["by"]})')
    if would_move:
        print("REFUSING — nothing was written. These items carry a review verdict and "
              "this script would move their answers:", file=sys.stderr)
        for w in would_move:
            print(f"  {w}", file=sys.stderr)
        print("\nMoving the answer on a reviewed item attaches a verdict to something "
              "the reviewer did not see. If they genuinely need rebalancing, clear the "
              "verdict first and review them again.", file=sys.stderr)
        return 2

    moved = 0
    for paper in d["papers"]:
        for n, item in enumerate(paper["items"]):
            opts = item["options"]
            if len(opts) < 2:
                continue
            # Belt and braces: even if the scan above missed one, never move a
            # reviewed item.
            if item["id"] in reviewed:
                continue
            want = n % len(opts)
            have = item["answer"]
            if want == have:
                continue
            right = opts[have]
            rest = [o for i, o in enumerate(opts) if i != have]
            item["options"] = rest[:want] + [right] + rest[want:]
            item["answer"] = want
            moved += 1
    p.write_text(json.dumps(d, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"moved {moved} answers")
    for paper in d["papers"]:
        c = Counter(it["answer"] for it in paper["items"])
        print(f"  {paper['id']:<20} {len(paper['items']):>2} items  positions {dict(sorted(c.items()))}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
