# Repository settings snapshot

**Taken:** 2026-10-01, before deleting and recreating `shahinamani/french-learning-for-world`.

**Why the rebuild.** The attribution trailer was stripped from every branch by a
history rewrite, but `refs/pull/1/head` still points at `77dc367`, and the
trailered commit `2909948` is an **ancestor** of it. GitHub keeps pull-request
refs permanently and offers no way to remove them, so that commit — and the
second name on the Contributors panel — cannot be removed from this repository
by any means short of recreating it.

Exactly **1** commit under `refs/pull/1/head` carries the trailer.
`refs/pull/2/head` is clean.

**Tooling note.** `gh` is not installed in this container, so everything below
was read from the REST API. Five endpoints are blocked by the agent proxy and
**could not be read** — see "Not captured". They are the one part of this
snapshot Shahin must check himself before deleting.

---

## Repository

| Setting | Value |
|---|---|
| name | `french-learning-for-world` |
| description | A free, open-source French learning platform — spaced repetition, CEFR A1–C2, built only on openly licensed content. |
| homepage | *(none)* |
| visibility | `public` |
| default branch | `main` |
| topics | *(none)* |
| is_template | `False` |
| has_issues | `True` |
| has_wiki | `True` |
| has_projects | `True` |
| has_downloads | `False` |
| has_discussions | `False` |
| allow_forking | `True` |
| archived | `False` |
| licence (detected) | `MIT` — from the committed `LICENSE` |

## Ruleset — must be recreated exactly

```json
[
  {
    "name": "main protection",
    "target": "branch",
    "enforcement": "active",
    "conditions": {
      "ref_name": {
        "exclude": [],
        "include": [
          "~DEFAULT_BRANCH"
        ]
      }
    },
    "rules": [
      {
        "type": "deletion"
      },
      {
        "type": "non_fast_forward"
      },
      {
        "type": "required_status_checks",
        "parameters": {
          "strict_required_status_checks_policy": false,
          "do_not_enforce_on_create": false,
          "required_status_checks": [
            {
              "context": "test",
              "integration_id": 15368
            },
            {
              "context": "browser",
              "integration_id": 15368
            }
          ]
        }
      }
    ],
    "bypass_actors": []
  }
]
```

The two required contexts are **`test`** and **`browser`**, which are the two job
names in `.github/workflows/ci.yml`. If the job names and the required contexts
ever disagree, the checks can never pass and `main` becomes unmergeable.

## Issues, labels, milestones, pull requests

- **Open issues: 0.** `open_issues_count` reads 1 because GitHub counts pull requests in that field.
- **Milestones: 0.**
- **Labels: 10** — all of them GitHub's defaults, recreated automatically on a new repository. Nothing custom to restore.
- **Pull requests:** #1 closed (its base was force-pushed), #2 open. The body of #2 is saved at `docs/pr-body.md`, verified free of attribution, and is what the replacement pull request will use.

## Workflows

`.github/workflows/ci.yml`, jobs `test` and `browser`.
**References no secrets and no variables** — checked: neither `secrets.` nor
`vars.` appears in the file. Its only permission block is `contents: read`.

## Not captured — blocked by the agent proxy, HTTP 403

These are **not** "empty"; they are **unread**. Shahin must confirm each before deleting:

| Endpoint | Result |
|---|---|
| `actions/secrets` | 403 — *Access to this GitHub Actions path is not permitted through this proxy* |
| `actions/variables` | 403 — same |
| `actions/permissions` | 403 — same |
| `environments` | 403 — *Access to this GitHub API path is not permitted through this proxy* |
| `pages` | 403 — same |

Secret and variable **values** cannot be read back through any route, by anyone,
so if any exist they must be supplied again by hand. The workflow needs none,
which is evidence that none are *required* — not evidence that none exist.

## Branches at snapshot time

```
040f92742cb7e0c49cdd4058e5d4caa415e7298d	refs/heads/feat/portal-foundation
ffb63939205df0b0651076daddabb2753a6ae677	refs/heads/main
```

## Pull refs — deliberately NOT carried over

```
77dc367d507b8a823a5e53b6ed25b27aae2a3952	refs/pull/1/head
040f92742cb7e0c49cdd4058e5d4caa415e7298d	refs/pull/2/head
4c2430f7c8ee17555c7d5d45655641d9d8164352	refs/pull/2/merge
```
