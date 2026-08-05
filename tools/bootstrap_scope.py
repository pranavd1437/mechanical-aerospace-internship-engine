"""Reset inherited operational state before the first run of a scoped fork.

Usage:
    python tools/bootstrap_scope.py --confirm mechanical

The source registry, health history, H-1B data, blocklist, and configuration
stay intact. Only discipline-dependent job/output/alert memory is reset. Every
target is a fixed repository path, and the required confirmation must match the
validated configured scope.
"""

from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from intern_engine import config, paths  # noqa: E402

JSON_STATE = {
    paths.JOBS_PATH: {},
    paths.STATS_PATH: {},
    paths.OBSERVED_PATH: {"companies": {}},
    paths.MAIL_STATE_PATH: {},
    paths.OUTBOX_PATH: {"pending": []},
}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--confirm",
        required=True,
        help="must exactly match data/config.json role_scope",
    )
    args = parser.parse_args()

    scope = config.role_scope(config.load_config())
    if args.confirm != scope:
        parser.error(f"confirmation {args.confirm!r} does not match configured scope {scope!r}")

    for path, payload in JSON_STATE.items():
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)
            f.write("\n")

    with open(paths.HISTORY_PATH, "w", encoding="utf-8"):
        pass

    print(f"Reset inherited operational state for role_scope={scope!r}.")
    print("Run `python run.py update`, inspect every open title, then run the accuracy gate.")


if __name__ == "__main__":
    main()
