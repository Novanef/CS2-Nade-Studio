"""Tests d'intégration pour core/plugin_client.py — un vrai serveur HTTP local
(voir CLAUDE.md / feedback_test_pyramid_practices : réseau localhost autorisé en
intégration, on stub le plugin CounterStrikeSharp plutôt que mocker `requests`)."""

import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest
import requests

from core import plugin_client


class _StubHandler(BaseHTTPRequestHandler):
    routes: dict = {}
    requests: list = []

    def _respond(self, status, body):
        payload = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(payload)

    def _handle(self):
        self.requests.append(self.path)
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
def stub_server():
    """Démarre un serveur HTTP réel sur un port libre ; les tests configurent
    `stub_server.routes` avant chaque appel à plugin_client."""
    handler = type("Handler", (_StubHandler,), {"routes": {}, "requests": []})
    server = HTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    server.handler = handler
    yield server
    server.shutdown()
    thread.join()


def test_get_position_found(stub_server):
    stub_server.handler.routes["/position"] = (200, {
        "Found": True, "X": 1.0, "Y": 2.0, "Z": 3.0, "Pitch": 4.0, "Yaw": 5.0,
    })

    result = plugin_client.get_position(port=stub_server.server_port)

    assert result == {"x": 1.0, "y": 2.0, "z": 3.0, "pitch": 4.0, "yaw": 5.0}


def test_get_position_no_player_returns_none(stub_server):
    stub_server.handler.routes["/position"] = (200, {"Found": False})

    assert plugin_client.get_position(port=stub_server.server_port) is None


def test_get_position_server_unreachable_raises():
    with pytest.raises(plugin_client.PluginUnavailableError):
        plugin_client.get_position(port=1, timeout=0.2)


def test_get_position_http_error_raises(stub_server):
    stub_server.handler.routes["/position"] = (500, {"error": "boom"})

    with pytest.raises(plugin_client.PluginUnavailableError):
        plugin_client.get_position(port=stub_server.server_port)


def test_is_player_connected_true(stub_server):
    stub_server.handler.routes["/position"] = (200, {
        "Found": True, "X": 0, "Y": 0, "Z": 0, "Pitch": 0, "Yaw": 0,
    })

    assert plugin_client.is_player_connected(port=stub_server.server_port) is True


def test_is_player_connected_false_when_unreachable():
    assert plugin_client.is_player_connected(port=1, timeout=0.2) is False


def test_get_map_name(stub_server):
    stub_server.handler.routes["/status"] = (200, {"mapName": "de_mirage"})

    assert plugin_client.get_map_name(port=stub_server.server_port) == "de_mirage"


def test_run_command_success(stub_server):
    stub_server.handler.routes["/debug/cmd"] = (200, {})

    plugin_client.run_command("bot_kick", port=stub_server.server_port)


def test_change_map_sends_changelevel_command(stub_server):
    stub_server.handler.routes["/debug/cmd"] = (200, {})

    plugin_client.change_map("dust2", port=stub_server.server_port)

    from urllib.parse import parse_qs, urlsplit

    sent = urlsplit(stub_server.handler.requests[-1])
    assert sent.path == "/debug/cmd"
    assert parse_qs(sent.query) == {"cmd": ["changelevel de_dust2"]}


def test_get_player_positions(stub_server):
    stub_server.handler.routes["/debug/player_positions"] = (200, {
        "positions": [{"x": 1, "y": 2, "z": 3}],
    })

    result = plugin_client.get_player_positions(port=stub_server.server_port)

    assert result == [{"x": 1, "y": 2, "z": 3}]


def test_teleport_success(stub_server):
    stub_server.handler.routes["/teleport"] = (200, {"success": True})

    assert plugin_client.teleport(1, 2, 3, 4, 5, port=stub_server.server_port) is True


def test_teleport_failure_reported_by_server(stub_server):
    stub_server.handler.routes["/teleport"] = (200, {"success": False})

    assert plugin_client.teleport(1, 2, 3, 4, 5, port=stub_server.server_port) is False


def test_prepare_capture(stub_server):
    stub_server.handler.routes["/capture/prepare"] = (200, {"original": {"hideHud": False}})

    assert plugin_client.prepare_capture(port=stub_server.server_port) == {"hideHud": False}


def test_prepare_capture_no_player_returns_none(stub_server):
    stub_server.handler.routes["/capture/prepare"] = (200, {"original": None})

    assert plugin_client.prepare_capture(port=stub_server.server_port) is None


def test_restore_capture_success(stub_server):
    stub_server.handler.routes["/capture/restore"] = (200, {"success": True})

    assert plugin_client.restore_capture({"hideHud": False}, port=stub_server.server_port) is True
