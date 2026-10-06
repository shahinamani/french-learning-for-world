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

# --- one message, before it becomes a commit --------------------------------
#
# `git commit` hands the commit-msg hook the message file. Refusing it here is
# the only place the fault can be stopped before anything permanent exists:
# pre-push is too late to avoid rewriting, and CI is too late altogether — by
# the time CI sees it a pull request has created refs/pull/*, which GitHub keeps
# for ever.
#
# The pattern list lives ONCE, above, so this mode and the full scan cannot
# drift apart.
if [ "${1:-}" = "--message" ]; then
  msg=${2:?--message needs a file}
  if grep -nEi "$PATTERNS" "$msg"; then
    echo "::error::This commit message carries an authorship trailer or tool name." >&2
    cat >&2 <<'WHY'

Every commit in this repository is authored by Shahin Amani and nothing else.

The reason, in one line: this repository is public, GitHub keeps refs/pull/*
permanently, and a trailer that reaches it cannot be removed without rebuilding
the repository.

If you are DESCRIBING this rule rather than breaking it, the scan cannot tell a
trailer from a sentence about one — reword the prose. See AGENTS.md.
WHY
    exit 1
  fi
  exit 0
fi

# Dump first, then check the dump is plausible. Piping `git log` straight into
# `grep` means a git failure produces an empty stream, grep finds nothing, and
# the scan reports "clean" without having read anything (docs/lessons.md #3).
dump=$(mktemp)
trap 'rm -f "$dump"' EXIT

# `--all` means the refs THIS CLONE has. CI fetches every branch, so CI sees
# refs a local clone may not — which is exactly how a clean pre-push and a red
# CI happened on 2026-10-06: the offending commit was on a branch whose local
# tracking ref had been removed. Fetching first makes the local answer the same
# answer, and a failure to fetch is reported rather than silently narrowing the
# scan.
if [ "${SKIP_FETCH:-}" != "1" ] && git rev-parse --git-dir >/dev/null 2>&1; then
  if ! git fetch --quiet --prune origin 2>/dev/null; then
    echo "note: could not reach the remote, so this scan covers local refs only."
    echo "      CI scans every branch on the remote and may still refuse."
  fi
fi

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
