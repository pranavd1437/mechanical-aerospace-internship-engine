import json

import pytest

from intern_engine import paths
from tools import bootstrap_scope


def test_reset_requires_matching_scope(monkeypatch):
    monkeypatch.setattr("sys.argv", ["bootstrap_scope.py", "--confirm", "tech"])
    monkeypatch.setattr(bootstrap_scope.config, "load_config", lambda: {"role_scope": "mechanical"})
    with pytest.raises(SystemExit):
        bootstrap_scope.main()


def test_reset_clears_only_scope_dependent_state(monkeypatch, tmp_path):
    targets = {
        "JOBS_PATH": tmp_path / "jobs.json",
        "STATS_PATH": tmp_path / "stats.json",
        "OBSERVED_PATH": tmp_path / "observed.json",
        "MAIL_STATE_PATH": tmp_path / "mail_state.json",
        "OUTBOX_PATH": tmp_path / "outbox.json",
        "HISTORY_PATH": tmp_path / "history.jsonl",
    }
    for name, path in targets.items():
        path.write_text("inherited", encoding="utf-8")
        monkeypatch.setattr(paths, name, str(path))

    monkeypatch.setattr(
        bootstrap_scope,
        "JSON_STATE",
        {
            str(targets["JOBS_PATH"]): {},
            str(targets["STATS_PATH"]): {},
            str(targets["OBSERVED_PATH"]): {"companies": {}},
            str(targets["MAIL_STATE_PATH"]): {},
            str(targets["OUTBOX_PATH"]): {"pending": []},
        },
    )
    monkeypatch.setattr("sys.argv", ["bootstrap_scope.py", "--confirm", "mechanical"])
    monkeypatch.setattr(bootstrap_scope.config, "load_config", lambda: {"role_scope": "mechanical"})

    bootstrap_scope.main()

    assert json.loads(targets["JOBS_PATH"].read_text()) == {}
    assert json.loads(targets["OBSERVED_PATH"].read_text()) == {"companies": {}}
    assert json.loads(targets["OUTBOX_PATH"].read_text()) == {"pending": []}
    assert targets["HISTORY_PATH"].read_text() == ""
