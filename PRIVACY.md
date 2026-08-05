# Privacy

Short version: this fork does not collect applicant data, account data, email
addresses, analytics, or other personal information.

## The dashboard

The dashboard is a static file served by GitHub Pages. It sets no cookies, loads
no third-party scripts, and runs no analytics. I don't know who visits it.

**Saved roles** (the ★ button) are stored in your browser's `localStorage`.
They never leave your device — not to me, not to anyone. Clearing site data
removes them. That's also why they don't sync across devices: there's no account
because there's no server holding your list.

## Alerts and email

This fork sets `notifications_enabled` to `false`, publishes no signup form,
and has no configured subscriber database, webhook, or mail sender. Some
optional upstream integration code and database schema remain for attribution
and auditability, but scheduled workflows do not call them.

## Job data

Everything about jobs comes from employers' public job boards. No personal data
of any applicant is involved at any point. I don't republish full posting
descriptions — only classifications derived from them (cycle, sponsorship
verdict, skill tags, pay when stated).

## Requests

Use GitHub's private vulnerability reporting if you believe this fork has
unexpectedly collected or exposed personal information.

## Changes

Material changes to this document will be noted in the repo's commit history,
which is public and permanent.
