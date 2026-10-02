#!/usr/bin/env bash
# Copy the canonical fonts and content into the app's public directory.
# They live once, at the repository root, and are copied in at build time so
# there is no second copy to drift.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p public/fonts public/content public/content/verbs
cp ../public/fonts/* public/fonts/
cp ../content/*.json public/content/
# The verb paradigms live in a subdirectory, and a flat *.json glob silently
# missed all six of them — the app built, the list rendered, and every verb
# page 404'd. A copy that skips a directory reports success exactly like one
# that does not.
cp ../content/verbs/*.json public/content/verbs/
echo "synced $(ls public/fonts | wc -l) font files, $(ls public/content/*.json | wc -l) content files and $(ls public/content/verbs/*.json | wc -l) verb shards"
