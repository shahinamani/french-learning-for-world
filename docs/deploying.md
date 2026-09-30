# Deploying the portal

The site is static: HTML, CSS, JavaScript and JSON, with no build step, no
dependencies and no server. The repository *is* the website.

## What that means in practice

- **Nothing to leak.** There is no database, no API key and no server
  credential, because there is no server. The strongest protection against
  publishing a secret is having none to publish.
- **Free.** GitHub Pages and Cloudflare Pages both host this at no cost, with
  a global CDN and automatic HTTPS.
- **Always live.** No process to crash, no bill to lapse, no disk to fill.
- **Works offline.** A service worker caches the shell and content on the
  first visit.

## GitHub Pages

1. **Settings → Pages → Source: GitHub Actions.**
2. Push to `main`. `.github/workflows/pages.yml` runs the tests and, only if
   they pass, publishes.
3. The site appears at `https://<user>.github.io/<repo>/`.

## A custom domain

A public repository and a custom domain are unrelated questions — open source
describes who may read the code, a domain is where visitors arrive. Wikipedia,
Firefox and Signal are all open source on their own domains.

1. Buy the domain (roughly 10–15 USD a year — the only cost of the project).
   **Enable WHOIS privacy protection.** Without it your name, postal address,
   telephone number and email become publicly searchable in the domain
   registry. This exposes far more than the repository ever could.
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

Connect the repository, leave the build command empty and set the output
directory to `/`. Custom domains and HTTPS are configured in the same
dashboard.

## Before announcing the site publicly

- Confirm `docs/content-provenance.md` matches what actually shipped.
- Confirm the independence notice is present and readable in every interface
  language: it is a legal statement, not decoration.
- Run `node --test tests/*.test.js` and check the browser console is clean.
