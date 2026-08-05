# Security Policy

## Reporting a vulnerability

Please **don't** open a public issue for a security problem.

Use GitHub's [private vulnerability reporting](../../security/advisories/new)
(Security → Report a vulnerability). Do not include secrets or personal data in
a public issue.

## What's in scope

- Anything that unexpectedly enables the disabled notification integrations or
  exposes credentials supplied by a future maintainer.
- Injection into generated artifacts (`README.md`, `docs/index.html`, the CSV,
  the Atom feed, the JSON API) via attacker-controlled job posting text.
- Anything that lets a third party alter what this repo publishes.
- Leaked credentials in the repo or in Actions logs.

## What's out of scope

- Content of third-party job postings themselves.
- Rate limits or availability of the ATS APIs we read.
- Reports from automated scanners with no demonstrated impact.
- The public Supabase publishable key — it's public by design and gated by
  row-level security (see `db/schema.sql`).

## Design notes relevant to security

- **No secrets in the repo.** All credentials are GitHub Actions secrets. Every
  integration no-ops silently when its env vars are unset.
- **Notifications are disabled by default.** This fork has no configured signup
  endpoint, subscriber database, webhook, or mail sender.
- **The CSV is neutralized** against spreadsheet formula injection (`=`, `+`,
  `-`, `@` prefixes), because job titles are third-party text.
- **All HTML output is escaped** at render time.
- **GitHub Actions are pinned to commit SHAs**, not mutable tags.
