import json

import pytest

from core import storage
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


@pytest.fixture
def isolated_storage(tmp_path, monkeypatch):
    """Redirige storage vers un dossier temporaire — jamais le vrai
    app/data/user/lineups.json de la machine du développeur."""
    lineups_file = tmp_path / "lineups.json"
    monkeypatch.setattr(storage, "USER_DIR", tmp_path)
    monkeypatch.setattr(storage, "LINEUPS_FILE", lineups_file)
    return lineups_file


def seed(lineups_file, lineups):
    lineups_file.write_text(json.dumps(lineups), encoding="utf-8")


def test_list_lineups_filters_by_map(isolated_storage):
    seed(isolated_storage, [
        make_lineup_dict(id="a", mapId="mirage"),
        make_lineup_dict(id="b", mapId="dust2"),
    ])
    result = storage.list_lineups(mapId="mirage")
    assert [l.id for l in result] == ["a"]


def test_list_lineups_filters_by_side(isolated_storage):
    seed(isolated_storage, [
        make_lineup_dict(id="a", side="CT"),
        make_lineup_dict(id="b", side="T"),
    ])
    assert [l.id for l in storage.list_lineups(side="CT")] == ["a"]


def test_list_lineups_side_none_returns_both(isolated_storage):
    seed(isolated_storage, [
        make_lineup_dict(id="a", side="CT"),
        make_lineup_dict(id="b", side="T"),
    ])
    assert {l.id for l in storage.list_lineups(side=None)} == {"a", "b"}


def test_list_lineups_filters_by_grenade_type(isolated_storage):
    seed(isolated_storage, [
        make_lineup_dict(id="a", grenadeType="smoke"),
        make_lineup_dict(id="b", grenadeType="flash"),
    ])
    assert [l.id for l in storage.list_lineups(grenadeType="flash")] == ["b"]


def test_list_lineups_filters_by_category(isolated_storage):
    seed(isolated_storage, [
        make_lineup_dict(id="a", category="standard"),
        make_lineup_dict(id="b", category="instant"),
    ])
    assert [l.id for l in storage.list_lineups(category="instant")] == ["b"]


def test_list_lineups_combines_filters(isolated_storage):
    seed(isolated_storage, [
        make_lineup_dict(id="a", mapId="mirage", side="T", grenadeType="smoke"),
        make_lineup_dict(id="b", mapId="mirage", side="T", grenadeType="flash"),
        make_lineup_dict(id="c", mapId="mirage", side="CT", grenadeType="smoke"),
        make_lineup_dict(id="d", mapId="dust2", side="T", grenadeType="smoke"),
    ])
    result = storage.list_lineups(mapId="mirage", side="T", grenadeType="smoke")
    assert [l.id for l in result] == ["a"]


def test_add_and_get_lineup(isolated_storage):
    seed(isolated_storage, [])
    lineup = Lineup(
        id="new1",
        mapId="mirage",
        side="T",
        grenadeType="he",
        spotName="Ramp HE",
        source="manual",
        createdAt="2026-01-01T00:00:00+00:00",
        updatedAt="2026-01-01T00:00:00+00:00",
        waypoints=[
            Waypoint(
                order=1,
                type="throw",
                referenceType="both",
                position=Position(x=1, y=2, z=3),
                viewAngle=ViewAngle(yaw=0, pitch=0),
                movement="stand",
                captured=True,
                clickType="left",
            )
        ],
    )
    storage.add_lineup(lineup)
    assert storage.get_lineup("new1") == lineup


def test_get_lineup_missing_returns_none(isolated_storage):
    seed(isolated_storage, [])
    assert storage.get_lineup("does-not-exist") is None


def test_update_lineup_persists_changes(isolated_storage):
    seed(isolated_storage, [make_lineup_dict(id="a", spotName="Old name", favorite=False)])
    updated = storage.update_lineup("a", spotName="New name", favorite=True)
    assert updated.spotName == "New name"
    assert updated.favorite is True
    # relu depuis le disque, pas seulement l'objet en mémoire retourné
    reloaded = storage.get_lineup("a")
    assert reloaded.spotName == "New name"
    assert reloaded.favorite is True


def test_update_lineup_missing_returns_none(isolated_storage):
    seed(isolated_storage, [])
    assert storage.update_lineup("missing", spotName="x") is None


def test_find_lineup_by_spawn_matches(isolated_storage):
    seed(isolated_storage, [
        make_lineup_dict(id="a", category="instant", spotName="Instant window", spawnPoint="spawn-1"),
        make_lineup_dict(id="b", category="instant", spotName="Instant window", spawnPoint="spawn-2"),
    ])
    found = storage.find_lineup_by_spawn(
        mapId="mirage", side="T", category="instant", spotName="Instant window", spawnPoint="spawn-2"
    )
    assert found.id == "b"


def test_find_lineup_by_spawn_no_match_returns_none(isolated_storage):
    seed(isolated_storage, [
        make_lineup_dict(id="a", category="instant", spotName="Instant window", spawnPoint="spawn-1"),
    ])
    found = storage.find_lineup_by_spawn(
        mapId="mirage", side="T", category="instant", spotName="Instant window", spawnPoint="spawn-2"
    )
    assert found is None


def test_delete_lineup(isolated_storage):
    seed(isolated_storage, [make_lineup_dict(id="a"), make_lineup_dict(id="b")])
    assert storage.delete_lineup("a") is True
    assert [l.id for l in storage.load_lineups()] == ["b"]


def test_delete_lineup_missing_returns_false(isolated_storage):
    seed(isolated_storage, [make_lineup_dict(id="a")])
    assert storage.delete_lineup("missing") is False
    assert [l.id for l in storage.load_lineups()] == ["a"]
