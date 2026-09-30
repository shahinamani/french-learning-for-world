#!/usr/bin/env bash
# Fails if any commit message in the repository carries tool attribution.
#
# Why this exists: a trailer added by default reached this public repository.
# Removing it needed a history rewrite; the rewrite closed a pull request; and
# the pull request's ref kept the offending commit alive permanently, because
# GitHub never removes refs/pull/*. The only remaining cure was to delete and
# rebuild the repository. Prevention is free. The cure cost a rebuild.
#
# Scans MESSAGES, not files. Documentation may discuss the episode by name —
# docs/lessons.md does — and must not be flagged for it.
set -uo pipefail

PATTERNS='Co-Authored-By|Claude|Anthropic|Generated with|🤖'

# Dump first, then check the dump is plausible. Piping `git log` straight into
# `grep` means a git failure produces an empty stream, grep finds nothing, and
# the scan reports "clean" without having read anything (docs/lessons.md #3).
dump=$(mktemp)
trap 'rm -f "$dump"' EXIT

if ! git log --all --format='%H%n%B%n---' > "$dump" 2>/dev/null; then
  echo "::error::git log failed — the scan read nothing and cannot be trusted"
  exit 2
fi

bytes=$(wc -c < "$dump")
commits=$(git rev-list --all --count)
echo "Scanned $commits commit messages, $bytes bytes."

# "Nothing to check" is a failure, not a pass (docs/lessons.md #2).
if [ "$commits" -lt 1 ] || [ "$bytes" -lt 50 ]; then
  echo "::error::the scan covered $commits commits / $bytes bytes — it did not read the repository"
  exit 2
fi

if grep -nEi "$PATTERNS" "$dump"; then
  echo "::error::A commit message carries tool attribution. Every commit is authored by Shahin Amani and nothing else."
  exit 1
fi

echo "No tool attribution in any commit message."
