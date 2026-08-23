"""Garde-fous sur le découpage BrowseApi (browse/consultation) vs Api (app
complète, main.py) — voir core/api_base.py et app/main_consultation.py."""

from core.api_base import BrowseApi

CAPTURE_ONLY_METHODS = [
    "start_capture",
    "start_edit_capture",
    "update_capture_fields",
    "teleport_to_spawn",
    "change_server_map",
    "get_server_map_name",
    "cancel_capture",
    "get_capture_draft",
    "save_capture",
    "toggle_hud",
    "set_active_lineup",
]

BROWSE_METHODS = [
    "get_mode",
    "get_maps",
    "get_spawnpoints",
    "get_asset_data_url",
    "get_screenshot_data_url",
    "get_screenshot_thumb_data_url",
    "get_screenshot_detail_data_url",
    "get_lineups",
    "get_lineup",
    "toggle_favorite",
    "delete_lineup",
    "delete_lineups",
    "delete_instant_group",
    "export_lineups",
    "export_library",
    "import_lineups",
]


def test_browse_api_does_not_expose_capture_methods():
    for name in CAPTURE_ONLY_METHODS:
        assert not hasattr(BrowseApi, name), f"BrowseApi ne doit pas exposer {name!r}"


def test_browse_api_get_mode_is_consultation():
    assert BrowseApi().get_mode() == "consultation"


def test_browse_api_exposes_all_browse_methods():
    for name in BROWSE_METHODS:
        assert hasattr(BrowseApi, name), f"BrowseApi doit exposer {name!r}"
