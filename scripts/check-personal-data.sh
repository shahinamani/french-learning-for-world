#!/usr/bin/env bash
#
# Refuse a personal email address in a tracked file.
#
# ONE script, called from the pre-push sweep and from CI, for the reason the
# attribution guard learned the hard way: the two had the same intent and
# different patterns, so a local pass and a CI pass meant different things. The
# local copy had been widened to catch a REGEX-ESCAPED address (`@gmail\.com`,
# which is how an address appears in source code, because that is where
# matchers live) and the CI copy had not. `CHECKLIST.md` recorded it as the
# first of three gaps.
#
# IT DOES NOT PRINT WHAT IT FOUND. A scanner whose failure output contains the
# address publishes it into a CI log that is world-readable on a public
# repository — turning a near miss into the exposure it exists to prevent. It
# prints the file and the line number, which is all anyone needs to go and look.
#
# Scans the WORKING TREE, not history: commit metadata carries the author's
# address by design, history is not rewritten, and scanning it would fail for
# ever on something already public and intended. What must stay clean is what a
# visitor reads today.
#
#   ./check-personal-data.sh [path]     default: the repository root
set -uo pipefail

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo .)
TARGET=${1:-$ROOT}

# The optional backslash is the whole point: `@gmail\.` is an address written
# for a regular expression, and the un-widened pattern walked straight past it.
DOMAINS='gmail|outlook|yahoo|hotmail|proton|icloud|gmx|mail\.ru|yandex'
PATTERN="[A-Za-z0-9._%+-]+@(${DOMAINS})\\\\?\\.[a-z]+"

hits=$(grep -rnEI --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist \
        --exclude-dir=.prerender --exclude-dir=coverage \
        "$PATTERN" "$TARGET" 2>/dev/null | cut -d: -f1,2)

if [ -n "$hits" ]; then
  count=$(printf '%s\n' "$hits" | wc -l | tr -d ' ')
  echo "::error::$count personal email address(es) in tracked files." >&2
  echo "Locations only — the matched text is deliberately not printed, because" >&2
  echo "this output reaches a public CI log:" >&2
  printf '%s\n' "$hits" | sed 's/^/  /' >&2
  exit 1
fi

echo "No personal email address in tracked files."
exit 0
