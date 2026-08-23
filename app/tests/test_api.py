"""Tests d'intégration pour la classe Api (main.py) — comportement observé par
l'UI, avec de vraies dépendances locales (storage sur tmp_path, CaptureSession
réelle, stub HTTP local pour le plugin) plutôt que des mocks, voir
feedback_test_pyramid_practices."""

import functools
import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest
import webview

import main
from core import api_base, plugin_client, storage
from core.capture import CaptureSession
from core.models import Lineup, Position, ViewAngle, Waypoint


def make_lineup_dict(**overrides) -> dict:
    defaults = dict(
        id="l1",
        mapId="mirage",
        side="T",
        grenadeType="smoke",
        category="standard",
        spawnPoint=None,
        spotName="Window smoke",
        notes="",
        favorite=False,
        source="manual",
        createdAt="2026-01-01T00:00:00+00:00",
        updatedAt="2026-01-01T00:00:00+00:00",
        waypoints=[],
    )
    defaults.update(overrides)
    return defaults


def seed(lineups_file, lineups):
    lineups_file.write_text(json.dumps(lineups), encoding="utf-8")


@pytest.fixture
def isolated_storage(tmp_path, monkeypatch):
    lineups_file = tmp_path / "lineups.json"
    monkeypatch.setattr(storage, "USER_DIR", tmp_path)
    monkeypatch.setattr(storage, "LINEUPS_FILE", lineups_file)
    return lineups_file


@pytest.fixture
def api(isolated_storage, monkeypatch):
    monkeypatch.setattr(main, "capture_session", CaptureSession())
    return main.Api()


def test_api_is_browse_api_subclass_in_full_mode():
    """Garde-fou anti-régression : Api (app complète) doit rester une sous-classe de
    BrowseApi (browse/consultation, voir core/api_base.py) et annoncer 'full', pas
    'consultation' — voir test_browse_api_get_mode_is_consultation dans test_api_base.py."""
    assert issubclass(main.Api, api_base.BrowseApi)
    assert main.Api().get_mode() == "full"


# --- get_asset_data_url / get_screenshot_data_url : garde-fou anti path traversal ---


def test_get_screenshot_data_url_reads_real_file(isolated_storage, api):
    screenshots_dir = isolated_storage.parent / "screenshots"
    screenshots_dir.mkdir()
    (screenshots_dir / "a.png").write_bytes(b"\x89PNG fake content")

    data_url = api.get_screenshot_data_url("screenshots/a.png")

    assert data_url is not None
    assert data_url.startswith("data:image/png;base64,")


def test_get_screenshot_data_url_rejects_path_traversal(isolated_storage, api):
    outside = isolated_storage.parent.parent / "secret.png"
    outside.write_bytes(b"nope")

    assert api.get_screenshot_data_url("../secret.png") is None


def test_get_screenshot_data_url_missing_file_returns_none(isolated_storage, api):
    assert api.get_screenshot_data_url("screenshots/missing.png") is None


# --- Lineups (CRUD exposé à l'UI) ---


def test_get_lineups_includes_throw_label(isolated_storage, api):
    seed(isolated_storage, [
        make_lineup_dict(
            id="a",
            waypoints=[{
                "order": 1,
                "type": "throw",
                "referenceType": "both",
                "position": {"x": 1, "y": 2, "z": 3},
                "viewAngle": {"yaw": 0, "pitch": 0},
                "movement": "run",
                "clickType": "left",
                "crouch": False,
                "screenshotRef": None,
                "screenshotZoomRef": None,
                "description": None,
                "captured": True,
            }],
        ),
    ])

    result = api.get_lineups()

    assert len(result) == 1
    assert result[0]["throwLabel"] == "Runthrow"


def test_toggle_favorite_flips_and_persists(isolated_storage, api):
    seed(isolated_storage, [make_lineup_dict(id="a", favorite=False)])

    result = api.toggle_favorite("a")

    assert result["status"] == "ok"
    assert result["lineup"]["favorite"] is True
    assert api.get_lineup("a")["favorite"] is True


def test_toggle_favorite_missing_lineup(isolated_storage, api):
    result = api.toggle_favorite("missing")

    assert result["status"] == "error"


def test_delete_lineup(isolated_storage, api):
    seed(isolated_storage, [make_lineup_dict(id="a")])

    result = api.delete_lineup("a")

    assert result["status"] == "deleted"
    assert api.get_lineup("a") is None


def test_delete_lineups_bulk(isolated_storage, api):
    seed(isolated_storage, [make_lineup_dict(id="a"), make_lineup_dict(id="b")])

    result = api.delete_lineups(["a"])

    assert result == {"status": "ok", "deleted": 1}
    assert [l["id"] for l in api.get_lineups()] == ["b"]


def test_delete_instant_group(isolated_storage, api):
    seed(isolated_storage, [
        make_lineup_dict(id="a", category="instant", spotName="Instant window", spawnPoint="spawn-1"),
        make_lineup_dict(id="b", category="instant", spotName="Instant window", spawnPoint="spawn-2"),
        make_lineup_dict(id="c", category="standard", spotName="Other lineup"),
    ])

    result = api.delete_instant_group("mirage", "T", "Instant window")

    assert result == {"status": "ok", "deleted": 2}
    assert [l["id"] for l in api.get_lineups()] == ["c"]


def test_delete_instant_group_no_matches(isolated_storage, api):
    seed(isolated_storage, [make_lineup_dict(id="a")])

    result = api.delete_instant_group("mirage", "T", "Instant window")

    assert result == {"status": "ok", "deleted": 0}


# --- export_lineups / export_library / import_lineups : boîtes de dialogue
# système, remplacées par un faux main_window (aucune vraie fenêtre en test) ---


class _FakeWindow:
    def __init__(self, dialog_result=None):
        self.dialog_result = dialog_result
        self.dialog_calls = []

    def create_file_dialog(self, dialog_type, **kwargs):
        self.dialog_calls.append((dialog_type, kwargs))
        return self.dialog_result


def test_export_lineups_writes_zip(isolated_storage, api, tmp_path, monkeypatch):
    seed(isolated_storage, [make_lineup_dict(id="a")])
    dest = tmp_path / "out.zip"
    fake_window = _FakeWindow(dialog_result=(str(dest),))
    monkeypatch.setattr(api_base, "main_window", fake_window)

    result = api.export_lineups(["a"])

    assert result == {"status": "ok", "count": 1, "missingScreenshots": 0}
    assert dest.is_file()
    assert fake_window.dialog_calls[0][0] == webview.FileDialog.SAVE


def test_export_lineups_cancelled_dialog(isolated_storage, api, monkeypatch):
    seed(isolated_storage, [make_lineup_dict(id="a")])
    monkeypatch.setattr(api_base, "main_window", _FakeWindow(dialog_result=None))

    result = api.export_lineups(["a"])

    assert result == {"status": "cancelled"}


def test_export_library_includes_all_lineups(isolated_storage, api, tmp_path, monkeypatch):
    seed(isolated_storage, [make_lineup_dict(id="a"), make_lineup_dict(id="b")])
    dest = tmp_path / "out.zip"
    monkeypatch.setattr(api_base, "main_window", _FakeWindow(dialog_result=(str(dest),)))

    result = api.export_library()

    assert result["count"] == 2


def test_import_lineups_from_dialog(isolated_storage, api, tmp_path, monkeypatch):
    from core import export_import

    export_dest = tmp_path / "export.zip"
    seed(isolated_storage, [make_lineup_dict(id="a")])
    export_import.build_export_zip(["a"], str(export_dest))
    # repart d'une bibliothèque vide pour observer l'import isolément
    seed(isolated_storage, [])
    monkeypatch.setattr(api_base, "main_window", _FakeWindow(dialog_result=(str(export_dest),)))

    result = api.import_lineups()

    assert result["status"] == "ok"
    assert result["imported"] == 1
    assert len(api.get_lineups()) == 1


def test_import_lineups_cancelled_dialog(isolated_storage, api, monkeypatch):
    monkeypatch.setattr(api_base, "main_window", _FakeWindow(dialog_result=None))

    result = api.import_lineups()

    assert result == {"status": "cancelled"}


# --- Flux de capture standard (start -> save), sans dépendre du plugin ---


def test_save_capture_requires_waypoint(api):
    api.start_capture(mapId="mirage", side="T", grenadeType="smoke", spotName="Window")

    result = api.save_capture()

    assert result["status"] == "error"


def test_save_capture_requires_spot_name(api):
    api.start_capture(mapId="mirage", side="T", grenadeType="smoke", spotName="   ")
    main.capture_session.draft.waypoint = Waypoint(
        order=1,
        type="throw",
        referenceType="both",
        position=Position(x=1, y=2, z=3),
        viewAngle=ViewAngle(yaw=0, pitch=0),
        movement="stand",
        clickType="left",
        crouch=False,
        captured=True,
    )

    result = api.save_capture()

    assert result["status"] == "error"


def test_start_capture_then_save_creates_lineup(isolated_storage, api):
    seed(isolated_storage, [])
    api.start_capture(mapId="mirage", side="T", grenadeType="smoke", spotName="Window smoke")
    main.capture_session.draft.waypoint = Waypoint(
        order=1,
        type="throw",
        referenceType="both",
        position=Position(x=1, y=2, z=3),
        viewAngle=ViewAngle(yaw=0, pitch=0),
        movement="stand",
        clickType="left",
        crouch=True,
        captured=True,
    )

    result = api.save_capture()

    assert result["status"] == "saved"
    assert api.get_capture_draft() is None
    lineups = api.get_lineups()
    assert len(lineups) == 1
    assert lineups[0]["spotName"] == "Window smoke"
    assert lineups[0]["waypoints"][0]["crouch"] is True


def test_start_capture_passes_crouch_to_draft(api):
    api.start_capture(mapId="mirage", side="T", grenadeType="smoke", spotName="Window", crouch=True)

    assert main.capture_session.draft.crouch is True


def test_update_capture_fields_passes_crouch_to_draft(api):
    api.start_capture(mapId="mirage", side="T", grenadeType="smoke", spotName="Window")

    api.update_capture_fields(
        mapId="mirage",
        side="T",
        grenadeType="smoke",
        spotName="Window",
        notes="",
        movement="stand",
        clickType="left",
        category="standard",
        spawnPoint=None,
        crouch=True,
    )

    assert main.capture_session.draft.crouch is True


def test_cancel_capture_clears_draft(api):
    api.start_capture(mapId="mirage", side="T", grenadeType="smoke", spotName="Window")

    result = api.cancel_capture()

    assert result["status"] == "cancelled"
    assert api.get_capture_draft() is None


# --- teleport_to_spawn / toggle_hud : orchestration plugin_client, via un vrai
# stub HTTP local (voir tests/test_plugin_client.py pour le même principe) ---


class _StubHandler(BaseHTTPRequestHandler):
    routes: dict = {}

    def _respond(self, status, body):
        payload = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(payload)

    def _handle(self):
        route = self.routes.get(self.path.split("?")[0])
        if route is None:
            self._respond(404, {"error": "not found"})
            return
        status, body = route
        self._respond(status, body)

    def do_GET(self):
        self._handle()

    def do_POST(self):
        self.rfile.read(int(self.headers.get("Content-Length", 0)))
        self._handle()

    def log_message(self, *args):
        pass


@pytest.fixture
def stub_plugin(monkeypatch):
    """Démarre un vrai serveur HTTP local imitant HttpApiServer.cs, et redirige
    les appels plugin_client.* faits depuis main.Api vers son port (au lieu du
    port par défaut 5050, pour ne jamais dépendre d'un vrai serveur CS2)."""
    handler = type("Handler", (_StubHandler,), {"routes": {}})
    server = HTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    for name in ["get_map_name", "get_player_positions", "get_position", "teleport",
                 "run_command", "prepare_capture", "restore_capture", "change_map"]:
        real = getattr(plugin_client, name)
        monkeypatch.setattr(main.plugin_client, name, functools.partial(real, port=server.server_port))

    server.handler = handler
    yield server
    server.shutdown()
    thread.join()


@pytest.fixture
def spawn_storage(isolated_storage, tmp_path, monkeypatch):
    """list_spawnpoints()/get_spawnpoint() lisent toujours SEED_DIR/spawnpoints.json
    (données statiques par carte, jamais copiées côté USER_DIR, voir storage.py) —
    on redirige SEED_DIR vers un dossier de test dédié plutôt que le seed versionné."""
    seed_dir = tmp_path / "seed"
    seed_dir.mkdir()
    (seed_dir / "spawnpoints.json").write_text(json.dumps([
        {"id": "sp1", "mapId": "mirage", "side": "T", "index": 1, "position": {"x": 10, "y": 20, "z": 30}},
    ]), encoding="utf-8")
    monkeypatch.setattr(storage, "SEED_DIR", seed_dir)
    return seed_dir


def test_teleport_to_spawn_wrong_map(api, stub_plugin, spawn_storage):
    stub_plugin.handler.routes["/status"] = (200, {"mapName": "de_dust2"})

    result = api.teleport_to_spawn("sp1")

    assert result["status"] == "error"
    assert "dust2" in result["message"]
    assert result["expectedMapId"] == "mirage"


def test_teleport_to_spawn_kicks_bots_then_teleports(api, stub_plugin, spawn_storage):
    stub_plugin.handler.routes["/status"] = (200, {"mapName": "de_mirage"})
    stub_plugin.handler.routes["/debug/player_positions"] = (200, {"positions": [{"isBot": True}]})
    stub_plugin.handler.routes["/debug/cmd"] = (200, {})
    stub_plugin.handler.routes["/position"] = (200, {
        "Found": True, "X": 0, "Y": 0, "Z": 0, "Pitch": 1.0, "Yaw": 2.0,
    })
    stub_plugin.handler.routes["/teleport"] = (200, {"success": True})

    result = api.teleport_to_spawn("sp1")

    assert result["status"] == "ok"


def test_teleport_to_spawn_no_player_found(api, stub_plugin, spawn_storage):
    stub_plugin.handler.routes["/status"] = (200, {"mapName": "de_mirage"})
    stub_plugin.handler.routes["/debug/player_positions"] = (200, {"positions": []})
    stub_plugin.handler.routes["/position"] = (200, {"Found": False})

    result = api.teleport_to_spawn("sp1")

    assert result["status"] == "error"
    assert "Aucun joueur" in result["message"]


def test_teleport_to_spawn_missing_spawn(api, stub_plugin, spawn_storage):
    result = api.teleport_to_spawn("missing")

    assert result["status"] == "error"


# --- change_server_map / get_server_map_name : correction du mismatch depuis l'UI ---


def test_change_server_map_success(api, stub_plugin):
    stub_plugin.handler.routes["/debug/cmd"] = (200, {})

    result = api.change_server_map("dust2")

    assert result["status"] == "ok"


def test_change_server_map_plugin_unavailable(api, monkeypatch):
    def raise_unavailable(*args, **kwargs):
        raise plugin_client.PluginUnavailableError("down")

    monkeypatch.setattr(main.plugin_client, "change_map", raise_unavailable)

    result = api.change_server_map("dust2")

    assert result["status"] == "error"


def test_get_server_map_name_success(api, stub_plugin):
    stub_plugin.handler.routes["/status"] = (200, {"mapName": "de_mirage"})

    assert api.get_server_map_name() == "de_mirage"


def test_get_server_map_name_plugin_unavailable(api, monkeypatch):
    def raise_unavailable(*args, **kwargs):
        raise plugin_client.PluginUnavailableError("down")

    monkeypatch.setattr(main.plugin_client, "get_map_name", raise_unavailable)

    assert api.get_server_map_name() is None


# --- _teleport_to_lineup / on_fix_map_hotkey : correction du mismatch en jeu (F7),
# voir le hotkey F6/on_test_hotkey qui appelle _teleport_to_lineup pendant que CS2
# a le focus, sans clic possible sur l'overlay ---


def make_lineup_with_throw(**overrides):
    defaults = dict(
        id="l1",
        mapId="dust2",
        side="T",
        grenadeType="smoke",
        spotName="Window smoke",
        source="manual",
        createdAt="2026-01-01T00:00:00+00:00",
        updatedAt="2026-01-01T00:00:00+00:00",
        waypoints=[
            Waypoint(
                order=1,
                type="throw",
                referenceType="both",
                position=Position(x=1, y=2, z=3),
                viewAngle=ViewAngle(yaw=10, pitch=20),
                movement="stand",
                captured=True,
                clickType="left",
                crouch=False,
            )
        ],
    )
    defaults.update(overrides)
    return Lineup(**defaults)


def test_teleport_to_lineup_wrong_map_sets_pending_fix(isolated_storage, stub_plugin, monkeypatch):
    monkeypatch.setattr(main, "_pending_map_fix", None)
    stub_plugin.handler.routes["/status"] = (200, {"mapName": "de_mirage"})
    storage.add_lineup(make_lineup_with_throw())

    result = main._teleport_to_lineup("l1")

    assert result["status"] == "error"
    assert main._pending_map_fix == "dust2"


def test_teleport_to_lineup_success_clears_pending_fix(isolated_storage, stub_plugin, monkeypatch):
    monkeypatch.setattr(main, "_pending_map_fix", "dust2")
    stub_plugin.handler.routes["/status"] = (200, {"mapName": "de_dust2"})
    stub_plugin.handler.routes["/debug/player_positions"] = (200, {"positions": []})
    stub_plugin.handler.routes["/teleport"] = (200, {"success": True})
    storage.add_lineup(make_lineup_with_throw())

    result = main._teleport_to_lineup("l1")

    assert result["status"] == "ok"
    assert main._pending_map_fix is None


def test_on_fix_map_hotkey_no_pending_fix(monkeypatch):
    monkeypatch.setattr(main, "_pending_map_fix", None)
    messages = []
    monkeypatch.setattr(main, "set_overlay_status", lambda state, message="": messages.append((state, message)))

    main.on_fix_map_hotkey()

    assert messages[-1][0] == "error"


def test_on_fix_map_hotkey_triggers_change_map(stub_plugin, monkeypatch):
    monkeypatch.setattr(main, "_pending_map_fix", "dust2")
    stub_plugin.handler.routes["/debug/cmd"] = (200, {})
    messages = []
    monkeypatch.setattr(main, "set_overlay_status", lambda state, message="": messages.append((state, message)))

    main.on_fix_map_hotkey()

    assert main._pending_map_fix is None
    assert "dust2" in messages[-1][1]


def test_on_fix_map_hotkey_plugin_unavailable(monkeypatch):
    monkeypatch.setattr(main, "_pending_map_fix", "dust2")

    def raise_unavailable(*args, **kwargs):
        raise plugin_client.PluginUnavailableError("down")

    monkeypatch.setattr(main.plugin_client, "change_map", raise_unavailable)
    messages = []
    monkeypatch.setattr(main, "set_overlay_status", lambda state, message="": messages.append((state, message)))

    main.on_fix_map_hotkey()

    assert messages[-1][0] == "error"


def test_toggle_hud_hides_then_shows(api, stub_plugin, monkeypatch):
    monkeypatch.setattr(main, "_hud_hidden_original", None)
    stub_plugin.handler.routes["/capture/prepare"] = (200, {"original": {"hideHud": False}})

    hide_result = api.toggle_hud()
    assert hide_result["status"] == "hidden"

    stub_plugin.handler.routes["/capture/restore"] = (200, {"success": True})
    show_result = api.toggle_hud()
    assert show_result["status"] == "shown"


def test_toggle_hud_no_player(api, stub_plugin, monkeypatch):
    monkeypatch.setattr(main, "_hud_hidden_original", None)
    stub_plugin.handler.routes["/capture/prepare"] = (200, {"original": None})

    result = api.toggle_hud()

    assert result["status"] == "no_player"
