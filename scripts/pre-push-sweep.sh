#!/usr/bin/env bash
# Everything CI will check, run before pushing rather than discovered after.
#
# CI went red on the rebuilt repository because I ran the secret hook locally
# but not the personal-data scan, which is a separate CI step. Two files I had
# just written carried an email address. The sweep existed; I only ran half of
# it. So it is one command now.
set -uo pipefail
fail=0
say() { printf '%s\n' "$*"; }

say "1. credential patterns in the working tree"
if ! ./.githooks/pre-commit >/dev/null 2>&1; then say "   FAIL"; fail=1; else say "   clean"; fi

say "2. tool attribution in any commit message"
if ! bash scripts/check-commit-messages.sh >/dev/null; then say "   FAIL"; fail=1; else say "   clean"; fi

# The optional backslash is not decoration. This pattern read `@gmail\.` as
# "gmail then a literal dot", so an address written for a REGEX — which is how a
# test asserts on one — had a backslash where the dot was expected and went
# straight through. One tracked test file carried the address that way for as
# long as the file existed. Found on 2026-10-06 while the step was refusing the
# same address spelled plainly three lines away in another file.
say "3. personal data in tracked files (the step that caught this)"
# One script, shared with CI. The two used to hold the same intent in two
# patterns, and only this one had been widened to catch a regex-escaped
# address — so a local pass and a CI pass meant different things.
if bash scripts/check-personal-data.sh >/dev/null 2>/tmp/pd.txt; then
  say "   clean"
else
  say "   FAIL — locations below; the addresses themselves are not printed"
  sed 's/^/     /' /tmp/pd.txt
  fail=1
fi

say "4. unit tests, with web dependencies hidden as CI has them"
hidden=0
if [ -d web/node_modules ]; then mv web/node_modules /tmp/_web_nm && hidden=1; fi
# Run the suite WITHOUT git's environment block.
#
# This sweep runs from the pre-push hook, and git gives a hook `GIT_DIR` and
# friends. Two tests build a throwaway repository in a temp directory and pass
# `cwd`; `GIT_DIR` beats `cwd`, so from a WORKTREE — where the exported value is
# absolute rather than the relative `.git` the main checkout exports — those
# tests addressed this repository: fixture commits on the live branch, and
# `user.email` overwritten in the config every worktree shares. Observed
# 2026-10-10.
#
# The tests clear the environment themselves now, which is the actual fix, and
# `tests/git-env.mjs` holds it with a test that fails if it regresses. This line
# is the second lock: a test added later that shells out to git without thinking
# about `GIT_DIR` is safe when the suite is run from here. It is NOT a
# substitute, because CI runs the suite directly and never comes through this
# script.
if env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE -u GIT_OBJECT_DIRECTORY \
       -u GIT_ALTERNATE_OBJECT_DIRECTORIES -u GIT_COMMON_DIR -u GIT_NAMESPACE \
       -u GIT_PREFIX -u GIT_CONFIG_GLOBAL -u GIT_CONFIG_SYSTEM -u GIT_CONFIG_COUNT \
       node --import ./tests/register.mjs --test tests/*.test.js >/tmp/units.txt 2>&1; then
  say "   $(grep -E '^# (tests|pass|fail)' /tmp/units.txt | tr '\n' ' ')"
else
  say "   FAIL"; grep -E '^not ok' /tmp/units.txt | head -5 | sed 's/^/     /'; fail=1
fi
[ "$hidden" = "1" ] && mv /tmp/_web_nm web/node_modules

say "5. nothing heavy or untracked staged"
git status --porcelain | grep -E '^\?\? (node_modules|web/dist|web/node_modules)' && { say "   FAIL"; fail=1; } || say "   clean"

[ "$fail" = "0" ] && say "ALL CLEAR" || say "SWEEP FAILED — do not push"
exit "$fail"
