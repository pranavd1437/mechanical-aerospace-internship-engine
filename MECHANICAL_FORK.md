# Mechanical & Aerospace Fork Guide

This branch turns the upstream Internship Engine into a precision-first tracker
for US mechanical and aerospace internships and co-ops. It discovers and links
roles; it does **not** fill or submit applications.

## Included scope

- Mechanical design, mechanisms, CAD, vehicle and product-development engineering
- Structures, stress, loads, durability, and FEA/CAE
- Manufacturing, tooling, machining, supplier quality, and metrology
- Mechanical, environmental, ground/flight, reliability, and validation test
- Thermal, fluids, CFD, aerodynamics, propulsion, combustion, and turbomachinery
- Materials, composites, metallurgy, and failure analysis
- Mechatronics, dynamics/controls, GNC, actuation, MBSE, and physically qualified systems
- Broad aerospace/aeronautical/astronautical engineering titles

The classifier is intentionally conservative. Generic `Engineering Intern` and
generic `Systems Engineering Intern` titles are excluded, as are explicit
software/data/AI, cyber/IT, QA/SDET, business, civil, chemical, biotech, and
doctoral roles. Specific functions win when several terms appear: an aircraft
structures title is categorized as `Structures & FEA`, not generic aerospace.

## Local setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
python -m pytest -q
python run.py update
python tools/verify_accuracy.py
```

To mirror the published feed into Google Sheets, follow
[`google-sheets/README.md`](google-sheets/README.md). The spreadsheet importer
requires a public GitHub/raw/Pages URL; it cannot read this local checkout.

`update` reads the employer boards and rebuilds the
README/dashboard/CSV/feed/API. This fork sets `notifications_enabled` to
`false`, so updates do not queue or send alerts. `notify` also exits without
sending unless that setting is deliberately changed after configuring services
you own.

## Fork safety

- The inherited Supabase signup endpoint and public key are removed from
  `data/config.json`; this fork cannot add subscribers to the upstream owner's
  mailing list.
- Operational job, alert, mail, history, and Drop Radar state should begin from
  a clean mechanical snapshot. The original upstream history remains recoverable
  from git.
- Do not copy upstream Discord, Brevo, database, or deployment secrets. Add only
  services you own, after reviewing the generated list.
- A GitHub-hosted fork automatically derives its own repository and Pages URLs
  from `GITHUB_REPOSITORY`. A purely local checkout may still display upstream
  link targets until it is given its own GitHub remote.

## Review checklist before publishing

1. Run the full test suite and lint check.
2. Run one update, then inspect every open title for false positives.
3. Run `python tools/verify_accuracy.py` and confirm the API IDs match the store.
4. Calibrate the `MIN_OPEN_ROLES` CI floor after several healthy scans; the
   bootstrap value is intentionally lower than the upstream tech-list floor.
5. Review changes before committing or pushing. Keep application submission a
   separate, human-controlled workflow.

## Attribution

This adaptation preserves the upstream MIT license and credits Shah Zain's
original automated internship engine.
