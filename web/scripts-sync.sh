#!/usr/bin/env bash
# Copy the canonical fonts and content into the app's public directory.
# They live once, at the repository root, and are copied in at build time so
# there is no second copy to drift.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p public/fonts public/content
cp ../public/fonts/* public/fonts/
cp ../content/*.json public/content/
echo "synced $(ls public/fonts | wc -l) font files and $(ls public/content | wc -l) content files"
