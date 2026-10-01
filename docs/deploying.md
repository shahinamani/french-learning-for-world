# Deploying

> # Hosting is Cloudflare Pages. Nothing is live until the DNS records exist.
>
> **Domain:** `frenchmavie.com`, registered at Namecheap, DNS stays there — so
> changing host later is two records, not a migration.
>
> **Host:** Cloudflare Pages, which builds `web/` from this repository and can
> set response headers from a `_headers` file. That is the reason it was chosen
> over GitHub Pages, which cannot: the Content-Security-Policy and HSTS this
> project wants are not expressible there at all.
>
> **Not on our own servers, deliberately.** This is a static site that needs
> none, and the server that would have hosted it carries salary and HR data for
> an unrelated project. A public, world-facing site does not belong beside that.

**Status: nothing is deployed, and nothing ever has been. Deliberately.**
Updated 2026-10-01.

## The state of things, with evidence

| | |
|---|---|
| GitHub Pages | **not enabled** — `GET /repos/:owner/:repo/pages` returns 404 |
| Deployments, all time | **zero** |
| `github-pages` environment | does not exist |
| Runs of the deploy workflow, all time | **one**, on the merge of pull request #1 |
| That run | test job **failed**, deploy job **skipped** |

Nobody has ever been served anything by this repository. That matters, because
the workflow was configured to publish `path: '.'` — the whole repository as a
website — and it is worth being precise that this was *latent* and never
*exposed*.

**The GitHub Pages workflow has been deleted.** It sat disabled for a while as
`pages.yml.disabled`, and leaving a switched-off file in the tree is a puzzle
for whoever reads it next: it looked like a thing that might be turned back on.
It will not be. Cloudflare builds from the repository on its own, with no
workflow of ours, so the file had no future and is gone rather than dormant.
Its history is in git if anyone wants it, and the reasoning that retired it is
the section below.

## Why this page had to be rewritten

It used to open:

> The site is static: HTML, CSS, JavaScript and JSON, with no build step, no
> dependencies and no server. The repository *is* the website.

**That was true and is now false.** It described the vanilla portal in `app/`,
which is plain files that can be served as they sit. The product is now a Vite
application in `web/`, whose output is `web/dist` and which does not exist until
`npm run build` has run. A deploy workflow with no build step cannot publish it.

A document that is wrong in its premise is worse than one that is missing,
because it is read and believed. The old text is quoted above rather than
deleted, so that anyone who remembers it can see it was retired on purpose.

## The decision that is actually open

There are three honest options, and the second and third are not interchangeable.

**1. Stay unpublished.** Current state, now held deliberately rather than by
accident. Costs nothing. Nothing is live, and nothing is claimed to be.

**2. Publish the vanilla portal (`app/` and the root files).** Keeps today's
working product live. Needs an assembly step, because the portal's files sit at
the repository root interleaved with `docs/`, `tests/` and `scripts/`, so
`path: '.'` would publish all of it. Work spent on the thing being replaced.

**3. Publish `web/dist`.** Needs `npm ci && npm run build` in `web/`, then
`path: web/dist`.

> **Option 3 is not a deployment change. It is the decision to retire `app/`.**
> Whichever directory is served *is* the product. `docs/07-claim-sweep.md` lists
> nine conditions for retiring the vanilla portal, and **two are unmet**: a real
> exams section rather than a stub, and an About / independence notice as its
> own destination. Those conditions exist precisely so this is not decided by a
> one-line change to a `path:`.

Until those two land, option 1 stands.

## When it is turned back on

1. Rename `pages.yml.disabled` back to `pages.yml`.
2. Add a build step, and set `path:` to what is actually being published.
3. **Settings → Pages → Source: GitHub Actions.** The workflow cannot enable
   Pages itself: `actions/configure-pages` takes an `enablement` input that
   defaults to `false`, and `GITHUB_TOKEN` lacks the permission regardless.
4. Push to `main`. The site appears at `https://<user>.github.io/<repo>/`.
5. Check the service worker's cached file list matches what was published —
   a stale precache list serves a half-updated app offline.

## A custom domain

Unchanged, and still accurate. A public repository and a custom domain are
unrelated questions: open source describes who may read the code, a domain is
where visitors arrive.

1. Buy the domain (roughly 10–15 USD a year — the only cost of the project).
   **Enable WHOIS privacy protection.** Without it your name, postal address,
   telephone number and email become publicly searchable in the domain
   registry. That exposes far more than the repository ever could.
2. DNS, for an apex domain such as `example.org`:

   | Type | Name | Value |
   |---|---|---|
   | A | @ | 185.199.108.153 |
   | A | @ | 185.199.109.153 |
   | A | @ | 185.199.110.153 |
   | A | @ | 185.199.111.153 |
   | CNAME | www | `<user>.github.io` |

   For a subdomain such as `learn.example.org`, a single `CNAME` to
   `<user>.github.io` is enough.

   Verify these against GitHub's current documentation before relying on them:
   published addresses change, and this file does not.
3. **Settings → Pages → Custom domain**, then enable **Enforce HTTPS** once the
   certificate is issued (usually within the hour).

GitHub writes a `CNAME` file into the repository holding the domain name. That
is not a secret — DNS is public by design — so it is safe to commit.

## Cloudflare Pages

Connect the repository, set the build command to `npm ci && npm run build` in
`web/`, and the output directory to `web/dist`. The old instruction here was
"leave the build command empty and set the output directory to `/`", which has
the same false premise as the opening of this page.

## Before announcing the site publicly

- Confirm `docs/content-provenance.md` and `docs/02-content-licences.md` match
  what actually shipped.
- Confirm the independence notice is present and readable in **every** interface
  language: it is a legal statement, not decoration.
- Confirm the stated CEFR ceiling matches the content. It is **B2**, and every
  learner-facing page says so.
- Run the full sweep — `scripts/pre-push-sweep.sh` — and both browser suites,
  and check the console is clean.
