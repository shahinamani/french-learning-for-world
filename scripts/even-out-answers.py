#!/usr/bin/env python3
"""Spread each paper's correct answers evenly across the option positions.

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
from collections import Counter

ROOT = pathlib.Path(__file__).resolve().parent.parent


def main() -> int:
    p = ROOT / "content/exam-papers.json"
    d = json.loads(p.read_text(encoding="utf-8"))
    moved = 0
    for paper in d["papers"]:
        for n, item in enumerate(paper["items"]):
            opts = item["options"]
            if len(opts) < 2:
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
