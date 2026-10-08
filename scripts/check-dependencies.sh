#!/usr/bin/env bash
#
# Dependency advisories, proportionate to what this project is.
#
# It ships no server and loads nothing cross-origin (CSP `connect-src 'self'`),
# so the realistic supply-chain route into a learner's browser is a compromised
# package in the PRODUCTION tree. That is what blocks:
#
#   production, high or above  -> FAILS the build
#   everything else            -> reported, does not fail
#
# The split is deliberate rather than lenient. A dev-server advisory that needs
# Windows and a local attacker, or a test runner's browser download, is not a
# risk to somebody revising French on a phone — and a gate that fails on those
# is a gate people learn to ignore, which costs more than it buys.
#
# Both trees are scanned: the root holds the browser-test tooling, `web/` holds
# the application.
#
# Triage lives in CHECKLIST.md with a date and a reason. A finding that is
# accepted is written down, never silently skipped.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

fail=0
unreachable=0

for tree in . web; do
  name=$([ "$tree" = "." ] && echo "root (test tooling)" || echo "web (the application)")
  echo "── $name ──"

  if ! out=$(cd "$tree" && npm audit --omit=dev --audit-level=high 2>&1); then
    # A REGISTRY THAT CANNOT BE REACHED IS NOT A CLEAN SCAN, and it is not a
    # vulnerability either. `npm audit` exits non-zero for both, so without this
    # an offline runner would report every dependency as advisory-laden — and a
    # gate that cries wolf when the network hiccups is one people disable.
    # Reported distinctly, with its own exit code, so CI can tell "we looked and
    # found nothing" from "we could not look".
    if printf '%s' "$out" | grep -qiE 'ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|ENETUNREACH|network|socket hang up|audit endpoint|registry.*unreachable|403 Forbidden|502 Bad Gateway|503 Service'; then
      echo "::warning::could not reach the audit service for $name — this is NOT a clean scan."
      printf '%s\n' "$out" | sed 's/^/  /'
      unreachable=1
    else
      echo "::error::production dependencies in $name carry a high or critical advisory."
      printf '%s\n' "$out" | sed 's/^/  /'
      fail=1
    fi
  else
    echo "  production: clean at high and above"
  fi

  # Reported, not enforced. A dev-only finding must not fail the build — but it
  # must not be invisible either, so the counts are printed every run.
  counts=$(cd "$tree" && npm audit --json 2>/dev/null \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
        try{const m=JSON.parse(s).metadata.vulnerabilities;
          const parts=Object.entries(m).filter(([k,v])=>v>0&&k!=="total").map(([k,v])=>`${v} ${k}`);
          console.log(parts.length?parts.join(", "):"none");
        }catch{console.log("unreadable")}})' 2>/dev/null)
  echo "  including dev: ${counts:-unreadable}"
done

if [ "$fail" = 1 ]; then
  echo ""
  echo "Triage before upgrading: does it reach a learner's browser? Record the" >&2
  echo "decision in CHECKLIST.md either way. Do not run 'npm audit fix --force'." >&2
  exit 1
fi
# Exit 2, not 0: the scan did not happen. A caller that treats this as success
# records a clean bill of health nobody issued. This block was dropped by a
# failed edit once, leaving `unreachable` set and never read — the script then
# reported "clean" after failing to reach the registry, which is the exact
# fault its test exists to catch. The test caught it.
if [ "$unreachable" = 1 ]; then
  echo ""
  echo "AUDIT UNAVAILABLE — the advisory database could not be reached, so" >&2
  echo "nothing here says these dependencies are clean. Re-run when online." >&2
  exit 2
fi

echo "No high or critical advisory in any production dependency."
