"""Tunable settings, loaded from data/config.json (with safe defaults).

Change behavior without touching code:
  - cycles        : the exact intern cycles to show, e.g. ["Summer 2027", "Fall 2026"].
                    These become the section headings, in this order.
  - default_cycle : where to put roles that have no clear term/year (e.g. just
                    "Software Engineer Intern"). Must be one of `cycles`.
  - regions       : ["US"] for United States only, ["US", "Canada"] for both,
                    or ["Global"] to disable the location filter entirely.
  - role_scope    : "tech", "mechanical" (mechanical/aerospace), or "all".
  - notifications_enabled: true only when alert/email delivery is deliberately armed.
"""

from __future__ import annotations

import json
import os
import re

from . import paths

DEFAULTS = {
    "cycles": ["Summer 2027", "Fall 2026"],
    "default_cycle": "Summer 2027",
    "regions": ["US"],
    "role_scope": "tech",
    "notifications_enabled": False,
}

_ROLE_SCOPE_META = {
    "tech": {
        "name": "tech",
        "title": "Tech",
        "description": (
            "Software Engineering, Data Science & Machine Learning "
            "(and closely related technical internships)"
        ),
        "skill_examples": "Python, C++, PyTorch",
        "search_example": "Python",
    },
    "mechanical": {
        "name": "mechanical & aerospace",
        "title": "Mechanical & Aerospace",
        "description": (
            "Mechanical design/CAD, structures/FEA, manufacturing/test, "
            "thermal/fluids/propulsion, materials, controls/mechatronics, "
            "and systems engineering internships"
        ),
        "skill_examples": "SolidWorks, GD&T, ANSYS",
        "search_example": "SolidWorks",
    },
    "all": {
        "name": "all-discipline",
        "title": "All-Discipline",
        "description": "All internship and co-op disciplines",
        "skill_examples": "SolidWorks, MATLAB, Python",
        "search_example": "design engineer",
    },
}

_FALLBACK_REPO = "pranavd1437/mechanical-aerospace-internship-engine"


def repo_slug() -> str:
    """"owner/name" for this repo: from Actions env, else the git remote."""
    env = os.environ.get("GITHUB_REPOSITORY")
    if env and "/" in env:
        return env
    try:
        with open(os.path.join(paths.ROOT, ".git", "config"), encoding="utf-8") as f:
            m = re.search(r"github\.com[:/]([\w.-]+/[\w.-]+?)(?:\.git)?\s", f.read())
            if m:
                return m.group(1)
    except OSError:
        pass
    return _FALLBACK_REPO


def pages_base() -> str:
    """The GitHub Pages base URL serving docs/ (dashboard, feed, JSON API)."""
    owner, _, name = repo_slug().partition("/")
    return f"https://{owner.lower()}.github.io/{name}"

_GLOBAL_TOKENS = {"global", "international", "worldwide", "any", "all"}
_US_TOKENS = {"us", "usa", "united states", "u.s.", "america"}


def load_config() -> dict:
    cfg = dict(DEFAULTS)
    try:
        with open(paths.CONFIG_PATH, encoding="utf-8") as f:
            cfg.update(json.load(f))
    except (OSError, json.JSONDecodeError):
        pass
    return cfg


def cycles(cfg: dict) -> list[str]:
    return list(cfg.get("cycles") or DEFAULTS["cycles"])


def role_scope(cfg: dict) -> str:
    """Validated role scope.

    Unknown values fail closed instead of silently behaving like ``all`` and
    publishing every internship on every tracked board.
    """
    value = str(cfg.get("role_scope") or DEFAULTS["role_scope"]).strip().lower()
    if value not in _ROLE_SCOPE_META:
        supported = ", ".join(sorted(_ROLE_SCOPE_META))
        raise ValueError(f"unsupported role_scope {value!r}; expected one of: {supported}")
    return value


def scope_name(cfg: dict) -> str:
    return _ROLE_SCOPE_META[role_scope(cfg)]["name"]


def scope_title(cfg: dict) -> str:
    return _ROLE_SCOPE_META[role_scope(cfg)]["title"]


def scope_description(cfg: dict) -> str:
    return _ROLE_SCOPE_META[role_scope(cfg)]["description"]


def scope_skill_examples(cfg: dict) -> str:
    return _ROLE_SCOPE_META[role_scope(cfg)]["skill_examples"]


def scope_search_example(cfg: dict) -> str:
    return _ROLE_SCOPE_META[role_scope(cfg)]["search_example"]


def restrict_region(cfg: dict) -> bool:
    regions = cfg.get("regions") or []
    if not regions:
        return False
    return not any(str(r).lower() in _GLOBAL_TOKENS for r in regions)


def want_us(cfg: dict) -> bool:
    return any(str(r).lower() in _US_TOKENS for r in (cfg.get("regions") or []))


def want_canada(cfg: dict) -> bool:
    return any(str(r).lower() == "canada" for r in (cfg.get("regions") or []))


def section_limit(cfg: dict, label: str):
    """Max rows to show for a section, or None for no cap."""
    return (cfg.get("section_limits") or {}).get(label)


def max_age_days(cfg: dict):
    """Drop roles published longer ago than this many days. 0/None = no limit."""
    return cfg.get("max_age_days", 365)


def max_per_company(cfg: dict):
    """Max roles to show per company per section, for variety. 0/None = no limit."""
    return cfg.get("max_per_company", 0)


def infer_undated(cfg: dict) -> bool:
    """When true, titles with no explicit year are bucketed into a cycle
    inferred from their posting date (recent postings only, marked `~`)."""
    return bool(cfg.get("infer_undated", True))


def infer_max_age_days(cfg: dict) -> int:
    """Only infer a cycle for roles posted within this many days — recency is
    what makes the inference trustworthy."""
    return int(cfg.get("infer_max_age_days", 45))


def allowlist_only(cfg: dict) -> bool:
    """When true, show only recognizable (priority-listed) companies. Off by default."""
    return bool(cfg.get("allowlist_only", False))


def include_international(cfg: dict) -> bool:
    """When true, also keep non-US roles (shown in a separate International section)."""
    return bool(cfg.get("include_international", False))


def notifications_enabled(cfg: dict) -> bool:
    """Whether alert and digest delivery is deliberately armed.

    Require the JSON boolean ``true`` rather than accepting truthy strings so
    a copied environment value cannot accidentally enable external delivery.
    """
    return cfg.get("notifications_enabled") is True


def signup_endpoint(cfg: dict) -> tuple[str, str] | None:
    """(supabase_url, publishable_key) for the email signup form, when configured.

    These are PUBLIC values by design (the key is Supabase's client-side
    "publishable" key; row-level security is what protects the data).
    """
    url = (cfg.get("supabase_url") or "").rstrip("/")
    key = cfg.get("supabase_publishable_key") or ""
    return (url, key) if url and key else None
