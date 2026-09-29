#!/usr/bin/env bash
# Point git at the tracked hooks. Run once per clone:  ./scripts/setup-hooks.sh
#
# Hooks are not cloned with a repository and are not enabled by default, so
# without this the secret scanner in .githooks/ is present but never runs.
set -euo pipefail
cd "$(dirname "$0")/.."
git config core.hooksPath .githooks
chmod +x .githooks/* 2>/dev/null || true
echo "Hooks enabled: core.hooksPath = $(git config core.hooksPath)"
echo "The pre-commit secret scanner is now active in this clone."
