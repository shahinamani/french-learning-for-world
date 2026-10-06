#!/usr/bin/env python3
"""Apply a reviewer's decisions to the content.

The review tool writes `data/review-decisions.json` and does NOT touch the
content. This applies them — and it exists as a separate Python script for one
reason: `content/exam-papers.json` is written by this project's own serialiser,
`json.dumps(..., ensure_ascii=False, indent=1)`. A Node round-trip would reformat
the whole file and make every review diff unreadable, and two serialisers for one
file is how two sources of truth begin.

What a decision does:

    approved   review.state -> "approved", with the reviewer's name and the date
    rejected   review.state -> "rejected", with the note, which is REQUIRED
    skipped    nothing. A skip is "not now", not a verdict, and the item stays
               in the queue.

An approval of an item flagged `uncertain` must carry a note: the flag says the
writer did not know, so an approval without a word about it loses the only
record that there was a question.

    python3 scripts/apply-review.py            # apply
    python3 scripts/apply-review.py --dry-run  # say what would change
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--decisions", help="default data/review-decisions.json")
    ap.add_argument("--papers", help="default content/exam-papers.json. A test points "
                                     "this at a copy: mutating the real file races with "
                                     "every other test that reads it.")
    args = ap.parse_args()

    dec_path = pathlib.Path(args.decisions) if args.decisions else ROOT / "data/review-decisions.json"
    if not dec_path.exists():
        print("no decisions to apply: data/review-decisions.json does not exist")
        return 0
    decisions = json.loads(dec_path.read_text(encoding="utf-8"))["decisions"]

    papers_path = (pathlib.Path(args.papers) if args.papers
                   else ROOT / "content/exam-papers.json")
    papers = json.loads(papers_path.read_text(encoding="utf-8"))
    by_id = {it["id"]: it for p in papers["papers"] for it in p["items"]}

    applied, skipped, refused = [], [], []
    for d in decisions:
        item = by_id.get(d["itemId"])
        if item is None:
            refused.append(f"{d['itemId']}: no such item")
            continue
        if d["verdict"] == "skipped":
            skipped.append(d["itemId"])
            continue
        if d["verdict"] == "rejected" and not (d.get("note") or "").strip():
            refused.append(f"{d['itemId']}: rejected with no reason")
            continue
        if (d["verdict"] == "approved" and item.get("uncertain")
                and not (d.get("note") or "").strip()):
            # The flag says the writer did not know. Approving it without a word
            # throws away the only record that there was a question.
            refused.append(f"{d['itemId']}: approved while flagged uncertain, with no note")
            continue
        item["review"] = {"state": d["verdict"], "by": d["by"], "at": d["at"],
                          "note": (d.get("note") or None)}
        applied.append(f"{d['itemId']} {d['verdict']} by {d['by']}")

    if refused:
        print("REFUSING — nothing was written:", file=sys.stderr)
        for r in refused:
            print(f"  {r}", file=sys.stderr)
        return 2

    if args.dry_run:
        print(f"would apply {len(applied)}, skip {len(skipped)}")
        for a in applied:
            print(f"  {a}")
        return 0

    papers_path.write_text(
        json.dumps(papers, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"applied {len(applied)} decisions, {len(skipped)} skips left in the queue")
    for a in applied:
        print(f"  {a}")
    states = {}
    for it in by_id.values():
        states[it["review"]["state"]] = states.get(it["review"]["state"], 0) + 1
    print(f"  item states now: {states}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
