# Contributing

Not yet open for outside contributions — the content plan is still being
settled. These rules apply from the first commit regardless.

## 1. This repository is public

Everything pushed here is published immediately and permanently. GitHub caches
and indexes pushes within seconds, and scrapers copy new commits. **A secret
committed and then removed in a later commit is still leaked** — it stays in
the object history, in forks, and in third-party databases.

**Never commit:**

- API keys, tokens, passwords, bearer tokens, service-account files
- Private keys, certificates, keystores (`*.pem`, `*.key`, `id_rsa`, `*.p12`)
- Connection strings containing credentials
- `.env` files — only `.env.example`, with empty placeholder values
- Server IP addresses, internal hostnames, deploy scripts naming real hosts
- Real personal data of anyone — names, emails, phone numbers, addresses
- Database dumps, backups, or exports of real data

All configuration is read from the environment. Commit the *name* of a
variable and its documentation, never its value. A default value in code is a
leak waiting for someone to forget to override it.

Enable the pre-commit scanner once per clone:

```bash
./scripts/setup-hooks.sh
```

Hooks are never cloned with a repository, so this must be run once in every
clone — otherwise the scanner is present but never runs.

Do not bypass it with `--no-verify`. If it fires, investigate.

**If a secret is committed:** revoke and rotate the credential *first* —
assume it is already compromised — then report it privately per
[SECURITY.md](SECURITY.md). Rotation is the fix; rewriting history is cleanup.

## 2. Content must be legally free to publish

Every card, sentence, recording and grammar note is either original work or
comes from an openly licensed source, and its provenance is recorded with it.

**Never commit** material copied from a commercial textbook, paid course,
proprietary word list, or any app's content — including a paraphrase of it.
Reusing someone's *selection* of vocabulary is reusing their work even when
none of their sentences are copied.

If you cannot state where an item came from and under what licence, it does
not go in. See [`docs/content-provenance.md`](docs/content-provenance.md).

## 3. Commit messages are as public as the diff

No internal hostnames, ticket numbers from private trackers, employer names or
personal details in commit messages, branch names or code comments.
