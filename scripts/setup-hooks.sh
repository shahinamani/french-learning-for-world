#!/usr/bin/env bash
# Point git at the tracked hooks. Run once per clone:  ./scripts/setup-hooks.sh
#
# Hooks are not cloned with a repository and are not enabled by default, so
# without this the hooks in .githooks/ are present but never run.
#
# Two hooks: pre-commit scans the staged diff for credentials, and pre-push
# runs the whole sweep before anything leaves the machine. The second exists
# because the sweep used to run only when somebody remembered to run it.
set -euo pipefail
cd "$(dirname "$0")/.."
git config core.hooksPath .githooks
chmod +x .githooks/* 2>/dev/null || true
echo "Hooks enabled: core.hooksPath = $(git config core.hooksPath)"
echo "Active in this clone:"
echo "  pre-commit — credential patterns in the staged diff"
echo "  pre-push   — the full sweep: credentials, attribution, personal data, unit tests"
