#!/usr/bin/env bash
# Point git at the tracked hooks. Run once per clone:  ./scripts/setup-hooks.sh
#
# Hooks are not cloned with a repository and are not enabled by default, so
# without this the hooks in .githooks/ are present but never run.
#
# Three hooks: commit-msg refuses an authorship trailer BEFORE the commit
# exists, pre-commit scans the staged diff for credentials, and pre-push runs
# the whole sweep before anything leaves the machine.
#
# commit-msg was added on 2026-10-06, after a session using a different tool
# committed a trailer here. The attribution scan reads every ref on purpose, so
# that one message reddened CI for every branch, and by the time CI saw it a
# pull request had created a ref GitHub keeps for ever. pre-push is better than
# CI; commit-msg is better than pre-push, because it is the only point at which
# the fault costs nothing.
set -euo pipefail
cd "$(dirname "$0")/.."
git config core.hooksPath .githooks
chmod +x .githooks/* 2>/dev/null || true
echo "Hooks enabled: core.hooksPath = $(git config core.hooksPath)"
echo "Active in this clone:"
echo "  commit-msg — authorship trailers, before the commit exists"
echo "  pre-commit — credential patterns in the staged diff"
echo "  pre-push   — the full sweep: credentials, attribution, personal data, unit tests"
