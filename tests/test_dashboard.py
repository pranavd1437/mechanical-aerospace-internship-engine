from intern_engine import dashboard, paths


def test_disabling_signup_removes_a_stale_unsubscribe_page(monkeypatch, tmp_path):
    monkeypatch.setattr(paths, "DOCS_DIR", str(tmp_path))
    stale = tmp_path / "unsubscribe.html"
    stale.write_text("upstream endpoint", encoding="utf-8")

    dashboard._write_unsubscribe({})

    assert not stale.exists()
