#!/usr/bin/env bash
# Copy the canonical fonts and content into the app's public directory.
# They live once, at the repository root, and are copied in at build time so
# there is no second copy to drift.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p public/fonts public/content public/content/verbs public/content/verb-cards public/content/word-cards
cp ../public/fonts/* public/fonts/
cp ../content/*.json public/content/
# The verb paradigms live in a subdirectory, and a flat *.json glob silently
# missed all six of them — the app built, the list rendered, and every verb
# page 404'd. A copy that skips a directory reports success exactly like one
# that does not.
cp ../content/verbs/*.json public/content/verbs/
cp ../content/verb-cards/*.json public/content/verb-cards/
# The word cards appear level by level as they are drafted; none yet is not an error.
cp ../content/word-cards/*.json public/content/word-cards/ 2>/dev/null || true
# One file per theme; the index (content/themes.json) comes with the flat copy.
mkdir -p public/content/themes
cp ../content/themes/*.json public/content/themes/

# The portal summary is ALSO copied into src/generated, because the landing page
# imports it rather than fetching it: the build-time prerender has to state the
# real figures, and a fetch has not happened yet when the HTML is written. 847
# bytes in the bundle buys a first screen whose numbers are not placeholders.
mkdir -p src/generated
cp ../content/portal-summary.json src/generated/portal-summary.json
echo "synced $(ls public/fonts | wc -l) font files, $(ls public/content/*.json | wc -l) content files and $(ls public/content/verbs/*.json | wc -l) verb shards"
