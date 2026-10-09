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



ROLES = ("owner", "teacher")
DECISIONS = ("approved", "rejected")


def fingerprint(item):
    """FNV-1a over the content a review is a judgement about.

    Mirrors `fingerprintItem` in web/src/lib/review-status.ts exactly — same
    fields, same order, same hash — because the browser decides whether a
    review is stale and this script decides what to record, and the two
    disagreeing would be worse than neither existing.

    Covers only what changes the exercise: prompt, options, answer key,
    explanation, stimulus. A new concept id must not throw away a teacher's
    work.
    """
    def sorted_entries(o):
        o = o or {}
        return [[k, o.get(k)] for k in sorted(o)]

    canonical = json.dumps([
        sorted_entries(item.get("prompt")),
        [o.get("fr") for o in (item.get("options") or [])],
        item.get("answer"),
        sorted_entries(item.get("explain")),
        (item.get("stimulus") or {}).get("fr"),
    ], ensure_ascii=False, separators=(",", ":"))

    # UTF-16 code units, because JavaScript's charCodeAt yields those. Iterating
    # Python characters instead would agree on every French string and diverge
    # on anything outside the basic plane — an emoji in an explanation would
    # make the browser call a fresh teacher review stale.
    units = canonical.encode("utf-16-le")
    h = 0x811c9dc5
    for i in range(0, len(units), 2):
        h ^= units[i] | (units[i + 1] << 8)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return format(h, "08x")


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
        # ── Role, and what makes a teacher claim a claim ──────────────────
        #
        # A missing role is an OWNER decision, never a teacher one: the 76
        # items in this file predate roles entirely, and nobody can
        # retroactively say a teacher looked at something.
        role = d.get("role") or "owner"
        if role not in ROLES:
            refused.append(f"{d['itemId']}: role {role!r} is not one of {ROLES}")
            continue
        if d["verdict"] not in DECISIONS:
            refused.append(f"{d['itemId']}: decision {d['verdict']!r} is not one of {DECISIONS}")
            continue
        # `role: "teacher"` on its own is an arbitrary string anybody could
        # type. What makes it attributable is naming the person AND what
        # qualifies them, in a file that is committed and readable.
        if role == "teacher" and not (d.get("credential") or "").strip():
            refused.append(f"{d['itemId']}: a teacher review needs a credential reference")
            continue
        if not (d.get("by") or "").strip():
            refused.append(f"{d['itemId']}: no reviewer named")
            continue

        record = {"decision": d["verdict"], "by": d["by"], "at": d["at"],
                  "note": (d.get("note") or None), "fingerprint": fingerprint(item)}
        if role == "teacher":
            record["credential"] = d["credential"]

        review = item.get("review") or {}
        # The two records never overwrite each other. A later owner decision
        # must not erase a teacher's evidence, and a teacher's must not erase
        # the author's own note about why they approved it.
        review[role] = record
        # The legacy summary still tracks the most recent decision of any role,
        # because even-out-answers.py refuses to touch an item that has one.
        review.update({"state": d["verdict"], "by": d["by"], "at": d["at"],
                       "note": (d.get("note") or None)})
        item["review"] = review
        applied.append(f"{d['itemId']} {d['verdict']} by {d['by']} ({role})")

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
