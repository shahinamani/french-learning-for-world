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

  # --- would the hook have caught this? ------------------------------------
  #
  # CI catching a trailer is already a failure of prevention: by the time CI
  # runs, a pull request has created refs/pull/*. But it is a WORSE failure if
  # the commit-msg hook could not have refused the same message, because then
  # no amount of discipline at the keyboard would have helped. That is a hole,
  # and it must be named rather than buried under the ordinary red.
  #
  # The pattern list is shared on purpose — two lists would drift, which is
  # half of what went wrong on 2026-10-06 — so this is NOT a check that the two
  # patterns agree. It is a check that the two CODE PATHS agree: one greps a
  # concatenated dump of every message, the other greps one message file. A
  # pattern matching across the dump's record boundary, a quoting difference, or
  # any transform added to one path later would show up here as a message this
  # scan refuses and the hook accepts.
  #
  # Offenders are identified from the dump the scan itself read, not by
  # re-running the hook's own test — that would compare a thing with itself and
  # could never fail, which is this project's commonest way of writing a check
  # that does nothing (docs/lessons.md, "am I comparing the right two things?").
  #
  # The matching is done by the SAME grep as above, and awk only maps the line
  # numbers it reported back to commits. The first version re-tested the lines
  # with `$0 ~ pat` under `IGNORECASE = 1`, which is a gawk extension: under the
  # awk on macOS and under mawk on CI it is silently an ordinary variable
  # assignment, so the walk was case-SENSITIVE while grep was not, and a
  # lower-case trailer was refused by the scan and then blamed on nobody. Two
  # existing tests caught it. Doing the matching once is the fix, not a second
  # dialect-dependent pattern.
  lines=$(grep -nEi "$PATTERNS" "$dump" | cut -d: -f1)
  offenders=$(awk -v lines="$lines" '
    BEGIN { start = 1; n = split(lines, L, "\n"); for (i = 1; i <= n; i++) want[L[i]+0] = 1 }
    start       { sha = $0; start = 0; next }
    $0 == "---" { start = 1; next }
    (FNR in want) { print sha }' "$dump" | sort -u)

  if [ -z "$offenders" ]; then
    # Two readings of one file disagreeing is itself a fault: grep refused the
    # dump and the record walk found nothing to blame.
    echo "::error::INCONSISTENT: the dump was refused but no commit could be named." >&2
    exit 2
  fi

  hole=0
  probe=$(mktemp)
  for sha in $offenders; do
    git log -1 --format='%B' "$sha" > "$probe"
    if bash "$0" --message "$probe" >/dev/null 2>&1; then
      echo "::error::HOLE — $sha is refused by the repository scan but ACCEPTED by" >&2
      echo "         the commit-msg hook, so nothing could have stopped it at the" >&2
      echo "         keyboard. Fix the hook, not just the commit." >&2
      hole=1
    else
      echo "  $sha — the commit-msg hook would also have refused this message."
    fi
  done
  rm -f "$probe"

  if [ "$hole" = 1 ]; then
    echo "::error::At least one offending message was invisible to the hook. This is a gap in prevention, not only a bad commit." >&2
    exit 3
  fi
  exit 1
fi

echo "No tool attribution in any commit message."
