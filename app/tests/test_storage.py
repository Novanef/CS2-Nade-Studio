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
                crouch=False,
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


def test_delete_lineups_removes_only_matching_ids(isolated_storage):
    seed(isolated_storage, [make_lineup_dict(id="a"), make_lineup_dict(id="b"), make_lineup_dict(id="c")])
    deleted = storage.delete_lineups(["a", "c", "missing"])
    assert deleted == 2
    assert [l.id for l in storage.load_lineups()] == ["b"]


def test_delete_lineups_no_matches_returns_zero(isolated_storage):
    seed(isolated_storage, [make_lineup_dict(id="a")])
    assert storage.delete_lineups(["missing"]) == 0
    assert [l.id for l in storage.load_lineups()] == ["a"]


def test_delete_lineup_group_removes_all_matching_spawns(isolated_storage):
    seed(isolated_storage, [
        make_lineup_dict(id="a", category="instant", spotName="Instant window", spawnPoint="spawn-1"),
        make_lineup_dict(id="b", category="instant", spotName="Instant window", spawnPoint="spawn-2"),
        make_lineup_dict(id="c", category="instant", spotName="Instant window", spawnPoint="spawn-3"),
        make_lineup_dict(id="unrelated", category="instant", spotName="Other spot", spawnPoint="spawn-1"),
    ])
    deleted = storage.delete_lineup_group(mapId="mirage", side="T", category="instant", spotName="Instant window")
    assert deleted == 3
    assert [l.id for l in storage.load_lineups()] == ["unrelated"]


def test_delete_lineup_group_no_matches_returns_zero(isolated_storage):
    seed(isolated_storage, [make_lineup_dict(id="a", category="instant", spotName="Other spot")])
    deleted = storage.delete_lineup_group(mapId="mirage", side="T", category="instant", spotName="Instant window")
    assert deleted == 0
    assert [l.id for l in storage.load_lineups()] == ["a"]


def test_delete_lineup_group_does_not_cross_side_or_map_boundaries(isolated_storage):
    seed(isolated_storage, [
        make_lineup_dict(id="a", mapId="mirage", side="T", category="instant", spotName="Instant window", spawnPoint="spawn-1"),
        make_lineup_dict(id="b", mapId="mirage", side="CT", category="instant", spotName="Instant window", spawnPoint="spawn-1"),
        make_lineup_dict(id="c", mapId="dust2", side="T", category="instant", spotName="Instant window", spawnPoint="spawn-1"),
    ])
    deleted = storage.delete_lineup_group(mapId="mirage", side="T", category="instant", spotName="Instant window")
    assert deleted == 1
    assert {l.id for l in storage.load_lineups()} == {"b", "c"}


def test_ensure_seeded_without_seed_file_creates_empty_list(tmp_path, monkeypatch):
    """Cas du build consultation-only, qui n'embarque pas app/data/seed/lineups.json —
    doit démarrer avec une bibliothèque vide plutôt que planter sur shutil.copyfile."""
    user_path = tmp_path / "user" / "lineups.json"
    missing_seed_path = tmp_path / "seed" / "lineups.json"
    monkeypatch.setattr(storage, "USER_DIR", tmp_path / "user")
    monkeypatch.setattr(storage, "LINEUPS_FILE", user_path)
    monkeypatch.setattr(storage, "SEED_DIR", tmp_path / "seed")

    assert not missing_seed_path.exists()
    lineups = storage.load_lineups()
    assert lineups == []
    assert user_path.exists()
    assert json.loads(user_path.read_text(encoding="utf-8")) == []


def test_configure_user_dir_redirects_lineups_and_screenshots(tmp_path):
    """main_consultation.py appelle ceci pour écrire dans %APPDATA% plutôt que dans
    le dossier d'installation de l'exe (souvent en lecture seule une fois empaqueté)."""
    new_root = tmp_path / "CS2NadeStudioViewer"
    original_user_dir = storage.USER_DIR
    original_lineups_file = storage.LINEUPS_FILE
    original_screenshots_dir = storage.SCREENSHOTS_DIR
    try:
        storage.configure_user_dir(new_root)
        assert storage.USER_DIR == new_root
        assert storage.LINEUPS_FILE == new_root / "lineups.json"
        assert storage.SCREENSHOTS_DIR == new_root / "screenshots"
    finally:
        storage.USER_DIR = original_user_dir
        storage.LINEUPS_FILE = original_lineups_file
        storage.SCREENSHOTS_DIR = original_screenshots_dir


def test_configure_user_dir_does_not_move_maps_file(tmp_path):
    """MAPS_FILE reste résolu depuis la racine bundle (lecture seule, radar + maps.json
    embarqués) — indépendant du répertoire utilisateur inscriptible."""
    original_maps_file = storage.MAPS_FILE
    try:
        storage.configure_user_dir(tmp_path / "CS2NadeStudioViewer")
        assert storage.MAPS_FILE == original_maps_file
    finally:
        storage.MAPS_FILE = original_maps_file
