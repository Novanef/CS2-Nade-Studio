"""Tests pour le mode édition de CaptureSession (bouton Éditer -> formulaire complet).

Ne couvre que la logique pure du draft (pas de capture réelle position/screenshot,
qui dépend du plugin/de l'écran — voir CLAUDE.md)."""

import pytest

from core.capture import CaptureSession, updated_lineup_fields
from core.models import Lineup, Position, ViewAngle, Waypoint


def make_waypoint(**overrides) -> Waypoint:
    defaults = dict(
        order=1,
        type="throw",
        referenceType="both",
        position=Position(x=1, y=2, z=3),
        viewAngle=ViewAngle(yaw=10, pitch=-5),
        movement="run",
        clickType="right",
        crouch=False,
        screenshotRef="screenshots/a.png",
        screenshotZoomRef="screenshots/a_zoom.png",
        captured=True,
    )
    defaults.update(overrides)
    return Waypoint(**defaults)


def make_lineup(**overrides) -> Lineup:
    defaults = dict(
        id="l1",
        mapId="mirage",
        side="T",
        grenadeType="smoke",
        spotName="Window smoke",
        source="manual",
        createdAt="2026-01-01T00:00:00+00:00",
        updatedAt="2026-01-01T00:00:00+00:00",
        category="standard",
        spawnPoint=None,
        notes="old notes",
        waypoints=[make_waypoint()],
    )
    defaults.update(overrides)
    return Lineup(**defaults)


def test_start_edit_prefills_draft_from_lineup():
    session = CaptureSession()
    lineup = make_lineup()

    draft = session.start_edit(lineup)

    assert draft.editingLineupId == "l1"
    assert draft.mapId == "mirage"
    assert draft.side == "T"
    assert draft.grenadeType == "smoke"
    assert draft.spotName == "Window smoke"
    assert draft.notes == "old notes"
    assert draft.category == "standard"
    assert draft.movement == "run"
    assert draft.clickType == "right"
    assert draft.crouch is False
    assert draft.waypoint is lineup.waypoints[0]


def test_start_edit_without_existing_waypoint_uses_defaults():
    session = CaptureSession()
    lineup = make_lineup(waypoints=[])

    draft = session.start_edit(lineup)

    assert draft.waypoint is None
    assert draft.movement == "stand"
    assert draft.clickType == "left"
    assert draft.crouch is False


def test_start_creates_draft_without_editing_id():
    session = CaptureSession()
    draft = session.start(mapId="mirage", side="T", grenadeType="smoke", spotName="New spot")
    assert draft.editingLineupId is None


def test_start_keeps_waypoint_when_field_changed_after_capture():
    """Régression : en création, taper le nom du spot (ou tout autre champ non
    structurel) après une capture F9 ne doit pas invalider le waypoint, sinon le
    bouton sauvegarder reste grisé tant que la capture n'est pas refaite en dernier."""
    session = CaptureSession()
    session.start(mapId="mirage", side="T", grenadeType="smoke", spotName="")
    session.draft.waypoint = make_waypoint()

    draft = session.start(mapId="mirage", side="T", grenadeType="smoke", spotName="Window smoke")

    assert draft.waypoint is not None
    assert draft.spotName == "Window smoke"


def test_start_resyncs_waypoint_metadata_from_form():
    session = CaptureSession()
    session.start(mapId="mirage", side="T", grenadeType="smoke", spotName="")
    session.draft.waypoint = make_waypoint()

    draft = session.start(
        mapId="mirage", side="T", grenadeType="smoke", spotName="x",
        movement="jump", clickType="left", crouch=True,
    )

    assert draft.waypoint.movement == "jump"
    assert draft.waypoint.clickType == "left"
    assert draft.waypoint.crouch is True


def test_start_invalidates_waypoint_on_map_change():
    session = CaptureSession()
    session.start(mapId="mirage", side="T", grenadeType="smoke", spotName="")
    session.draft.waypoint = make_waypoint()

    draft = session.start(mapId="dust2", side="T", grenadeType="smoke", spotName="x")

    assert draft.waypoint is None


def test_start_invalidates_waypoint_on_spawn_change():
    session = CaptureSession()
    session.start(mapId="mirage", side="T", grenadeType="smoke", spotName="", category="instant", spawnPoint="spawn-1")
    session.draft.waypoint = make_waypoint()

    draft = session.start(
        mapId="mirage", side="T", grenadeType="smoke", spotName="x",
        category="instant", spawnPoint="spawn-2",
    )

    assert draft.waypoint is None


def test_start_does_not_leak_waypoint_from_editing_session():
    session = CaptureSession()
    session.start_edit(make_lineup())

    draft = session.start(mapId="mirage", side="T", grenadeType="smoke", spotName="Brand new")

    assert draft.waypoint is None
    assert draft.editingLineupId is None


def test_update_fields_keeps_waypoint_when_map_and_side_unchanged():
    session = CaptureSession()
    lineup = make_lineup()
    session.start_edit(lineup)

    draft = session.update_fields(
        mapId="mirage",
        side="T",
        grenadeType="flash",
        spotName="Renamed spot",
        notes="new notes",
        movement="jump",
        clickType="left",
        crouch=True,
        category="standard",
        spawnPoint=None,
    )

    assert draft.waypoint is not None
    assert draft.grenadeType == "flash"
    assert draft.spotName == "Renamed spot"
    assert draft.notes == "new notes"
    # métadonnées du waypoint resynchronisées depuis le formulaire
    assert draft.waypoint.movement == "jump"
    assert draft.waypoint.clickType == "left"
    assert draft.waypoint.crouch is True
    # la position/le screenshot ne sont pas touchés
    assert draft.waypoint.position.x == 1
    assert draft.waypoint.screenshotRef == "screenshots/a.png"


def test_update_fields_invalidates_waypoint_on_map_change():
    session = CaptureSession()
    session.start_edit(make_lineup())

    draft = session.update_fields(
        mapId="dust2",
        side="T",
        grenadeType="smoke",
        spotName="Window smoke",
        notes="",
        movement="stand",
        clickType="left",
        crouch=False,
        category="standard",
        spawnPoint=None,
    )

    assert draft.waypoint is None
    assert draft.mapId == "dust2"


def test_update_fields_invalidates_waypoint_on_spawn_change():
    session = CaptureSession()
    session.start_edit(make_lineup(category="instant", spawnPoint="spawn-1"))

    draft = session.update_fields(
        mapId="mirage",
        side="T",
        grenadeType="smoke",
        spotName="Window smoke",
        notes="",
        movement="run",
        clickType="right",
        crouch=False,
        category="instant",
        spawnPoint="spawn-2",
    )

    assert draft.waypoint is None
    assert draft.spawnPoint == "spawn-2"


def test_update_fields_invalidates_waypoint_on_side_change():
    session = CaptureSession()
    session.start_edit(make_lineup())

    draft = session.update_fields(
        mapId="mirage",
        side="CT",
        grenadeType="smoke",
        spotName="Window smoke",
        notes="",
        movement="stand",
        clickType="left",
        crouch=False,
        category="standard",
        spawnPoint=None,
    )

    assert draft.waypoint is None


def test_update_fields_without_draft_raises():
    session = CaptureSession()
    with pytest.raises(ValueError):
        session.update_fields(
            mapId="mirage",
            side="T",
            grenadeType="smoke",
            spotName="x",
            notes="",
            movement="stand",
            clickType="left",
            crouch=False,
            category="standard",
            spawnPoint=None,
        )


def test_updated_lineup_fields_maps_draft_to_storage_update_kwargs():
    session = CaptureSession()
    session.start_edit(make_lineup())
    draft = session.draft

    fields = updated_lineup_fields(draft)

    assert fields["mapId"] == "mirage"
    assert fields["side"] == "T"
    assert fields["grenadeType"] == "smoke"
    assert fields["category"] == "standard"
    assert fields["spawnPoint"] is None
    assert fields["spotName"] == "Window smoke"
    assert fields["notes"] == "old notes"
    assert fields["waypoints"] == [draft.waypoint]
    assert "updatedAt" in fields
    assert "editingLineupId" not in fields


def test_updated_lineup_fields_requires_waypoint():
    session = CaptureSession()
    session.start_edit(make_lineup(waypoints=[]))
    with pytest.raises(ValueError):
        updated_lineup_fields(session.draft)
