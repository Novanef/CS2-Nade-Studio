"""Tests pour l'orchestration Api.update_capture_fields en mode édition d'un
groupe "instant" : choisir un spawn déjà capturé par un autre lineup du groupe
doit basculer l'édition sur ce lineup (affiche sa capture existante), voir
CLAUDE.md / le fil de discussion sur le bug "screenshot ne correspond plus au
bon spawn"."""

import json

import pytest

import main
from core.capture import CaptureSession
from core import storage


def make_lineup_dict(**overrides) -> dict:
    defaults = dict(
        id="l1",
        mapId="mirage",
        side="T",
        grenadeType="smoke",
        category="instant",
        spawnPoint="spawn-1",
        spotName="Instant window",
        notes="",
        favorite=False,
        source="plugin_capture",
        createdAt="2026-01-01T00:00:00+00:00",
        updatedAt="2026-01-01T00:00:00+00:00",
        waypoints=[
            {
                "order": 1,
                "type": "throw",
                "referenceType": "both",
                "position": {"x": 1, "y": 2, "z": 3},
                "viewAngle": {"yaw": 0, "pitch": 0},
                "movement": "run",
                "clickType": "left",
                "screenshotRef": "screenshots/a.png",
                "screenshotZoomRef": None,
                "description": None,
                "captured": True,
            }
        ],
    )
    defaults.update(overrides)
    return defaults


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


def seed(lineups_file, lineups):
    lineups_file.write_text(json.dumps(lineups), encoding="utf-8")


def test_switching_to_already_captured_spawn_loads_its_own_data(api, isolated_storage):
    seed(isolated_storage, [
        make_lineup_dict(id="a", spawnPoint="spawn-1"),
        make_lineup_dict(
            id="b",
            spawnPoint="spawn-2",
            waypoints=[
                {
                    "order": 1,
                    "type": "throw",
                    "referenceType": "both",
                    "position": {"x": 40, "y": 50, "z": 0},
                    "viewAngle": {"yaw": 90, "pitch": 0},
                    "movement": "stand",
                    "clickType": "right",
                    "screenshotRef": "screenshots/b.png",
                    "screenshotZoomRef": None,
                    "description": None,
                    "captured": True,
                }
            ],
        ),
    ])
    api.start_edit_capture("a")

    result = api.update_capture_fields(
        mapId="mirage",
        side="T",
        grenadeType="smoke",
        spotName="Instant window",
        notes="",
        movement="run",
        clickType="left",
        category="instant",
        spawnPoint="spawn-2",
    )

    assert result["editingLineupId"] == "b"
    assert result["waypoint"]["position"]["x"] == 40
    assert result["waypoint"]["screenshotRef"] == "screenshots/b.png"


def test_switching_to_empty_spawn_still_invalidates_waypoint(api, isolated_storage):
    seed(isolated_storage, [make_lineup_dict(id="a", spawnPoint="spawn-1")])
    api.start_edit_capture("a")

    result = api.update_capture_fields(
        mapId="mirage",
        side="T",
        grenadeType="smoke",
        spotName="Instant window",
        notes="",
        movement="run",
        clickType="left",
        category="instant",
        spawnPoint="spawn-3",
    )

    assert result["editingLineupId"] == "a"
    assert result["waypoint"] is None


def test_reselecting_own_spawn_keeps_editing_same_lineup(api, isolated_storage):
    seed(isolated_storage, [make_lineup_dict(id="a", spawnPoint="spawn-1")])
    api.start_edit_capture("a")

    result = api.update_capture_fields(
        mapId="mirage",
        side="T",
        grenadeType="smoke",
        spotName="Instant window",
        notes="",
        movement="run",
        clickType="left",
        category="instant",
        spawnPoint="spawn-1",
    )

    assert result["editingLineupId"] == "a"
    assert result["waypoint"] is not None
