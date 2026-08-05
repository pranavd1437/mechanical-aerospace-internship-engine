import pytest

from intern_engine import config


def test_role_scope_defaults_to_tech_for_upstream_compatibility():
    assert config.role_scope({}) == "tech"


def test_mechanical_scope_metadata():
    cfg = {"role_scope": "mechanical"}
    assert config.role_scope(cfg) == "mechanical"
    assert config.scope_title(cfg) == "Mechanical & Aerospace"
    assert "structures/FEA" in config.scope_description(cfg)
    assert config.scope_search_example(cfg) == "SolidWorks"


def test_unknown_role_scope_fails_closed():
    with pytest.raises(ValueError, match="unsupported role_scope"):
        config.role_scope({"role_scope": "everything"})


def test_notifications_require_explicit_json_true():
    assert config.notifications_enabled({}) is False
    assert config.notifications_enabled({"notifications_enabled": False}) is False
    assert config.notifications_enabled({"notifications_enabled": "true"}) is False
    assert config.notifications_enabled({"notifications_enabled": True}) is True
