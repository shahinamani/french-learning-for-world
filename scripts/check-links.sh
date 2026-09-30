#!/usr/bin/env bash
# Verify every outbound link in content/exams.json, and record the date.
#
# The links in that file point at other organisations' websites, which move and
# reorganise without telling anyone. Run this before a release, and whenever a
# learner reports a broken link.
#
#   ./scripts/check-links.sh          # check only
#   ./scripts/check-links.sh --write  # check, and stamp checkedOn if all pass
set -uo pipefail
cd "$(dirname "$0")/.."

# Extract first and check it worked. An empty list must never read as
# "all links resolved" — that is a check that cannot fail.
urls_raw=$(node -e '
  const doc = require("./content/exams.json");
  const seen = new Set();
  for (const e of doc.exams) for (const r of e.resources) seen.add(r.url);
  for (const u of seen) console.log(u);
') || { echo "FAILED: could not read content/exams.json" >&2; exit 2; }

mapfile -t urls <<< "$urls_raw"
if [ "${#urls[@]}" -eq 0 ] || [ -z "${urls[0]}" ]; then
  echo "FAILED: no links found to check. Either exams.json has none, or the" >&2
  echo "extraction broke. Refusing to report success on an empty set." >&2
  exit 2
fi

echo "Checking ${#urls[@]} distinct links…"
failed=0
for u in "${urls[@]}"; do
  code=$(curl -sS -o /dev/null -w '%{http_code}' -L --max-time 25 \
         -A 'french-learning-for-world link checker' "$u" 2>/dev/null || echo 000)
  case "$code" in
    2*|3*) printf '  ok    %s  %s\n' "$code" "$u" ;;
    000)   printf '  NET   ---  %s  (no response — network, DNS or egress policy)\n' "$u"; failed=1 ;;
    *)     printf '  FAIL  %s  %s\n' "$code" "$u"; failed=1 ;;
  esac
done

if [ "$failed" -ne 0 ]; then
  echo
  echo "Some links did not resolve. Fix them before stamping a check date —"
  echo "a date that says 'verified' when it was not is worse than no date."
  exit 1
fi

echo "All links resolved."
if [ "${1:-}" = "--write" ]; then
  node -e '
    const fs = require("fs");
    const p = "content/exams.json";
    const doc = JSON.parse(fs.readFileSync(p, "utf8"));
    doc.checkedOn = new Date().toISOString().slice(0, 10);
    fs.writeFileSync(p, JSON.stringify(doc, null, 2) + "\n");
    console.log("checkedOn set to " + doc.checkedOn);
  '
fi
