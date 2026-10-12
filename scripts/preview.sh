#!/usr/bin/env bash
# The owner's private preview. Loopback only — this is NOT a deployment.
#
#     ./scripts/preview.sh            build if needed, then serve
#     ./scripts/preview.sh --rebuild  always rebuild first
#
# It binds 127.0.0.1, so nothing on the network and nothing on the internet can
# reach it. There is no DNS, no host, no account and no cost involved. Saying
# "the preview is up" means a process is running on this Mac and nothing more.
#
# Why this file exists: the first preview was started by hand, wedged, and kept
# holding the port while answering nothing. The owner clicked a correct link and
# got a spinner. A restart has to be one command, and it has to check that the
# server actually ANSWERS rather than that the port is taken.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

PORT="${PORT:-8793}"
URL="http://127.0.0.1:${PORT}/"

# Anything already on the port is cleared first — including a wedged server,
# which is the exact failure this script was written after. A bound port is not
# evidence of a working server.
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "something is already on ${PORT}; stopping it"
  lsof -ti TCP:"$PORT" -sTCP:LISTEN | xargs -r kill
  sleep 1
fi

if [ "${1:-}" = "--rebuild" ] || [ ! -f web/dist/index.html ]; then
  echo "building the app"
  ( cd web && npm run build ) || { echo "BUILD FAILED — not serving a stale dist" >&2; exit 1; }
fi

echo "starting the preview"
( cd web && python3 e2e/gzserver.py dist "$PORT" ) &
SERVER=$!

# Wait for a real 200 on real bytes. `curl --fail` on the index is the check,
# not `lsof`: the whole point of this script is that the two are different.
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null -m 3 "$URL"; then
    echo ""
    echo "  Preview ready:  ${URL}"
    echo "  Loopback only — reachable from this Mac, nowhere else."
    echo "  Stop it with Ctrl-C, or: kill ${SERVER}"
    echo ""
    wait "$SERVER"
    exit 0
  fi
  sleep 1
done

echo "FAILED: the server did not answer within 30s. It is not serving." >&2
kill "$SERVER" 2>/dev/null
exit 1
