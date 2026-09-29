# Security policy

## Reporting a vulnerability

Please report security issues privately through GitHub's
[private vulnerability reporting](https://docs.github.com/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability)
on this repository, rather than opening a public issue.

Please include what you found, how to reproduce it, and what an attacker could
do with it. You will get an acknowledgement, and credit in the fix unless you
prefer otherwise.

## Secrets

This repository is public. **No credential, key, token, password, connection
string, private hostname or personal datum may ever be committed** — see
[CONTRIBUTING.md](CONTRIBUTING.md).

All configuration is read from the environment. Only `.env.example`, holding
empty placeholder values, is ever committed.

A pre-commit hook in `.githooks/` scans staged changes for credential
patterns. Enable it once per clone:

```bash
./scripts/setup-hooks.sh
```

Hooks are never cloned with a repository, so this must be run once in every
clone — otherwise the scanner is present but never runs.

If you believe a secret has been committed, **do not open a public issue** —
report it privately as above so the credential can be rotated first.
