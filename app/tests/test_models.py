from core.models import Lineup, Map, Position, SpawnPoint, ViewAngle, Waypoint, derive_throw_label


def make_waypoint(**overrides) -> Waypoint:
    defaults = dict(
        order=1,
        type="throw",
        referenceType="both",
        position=Position(x=1.0, y=2.0, z=3.0),
        viewAngle=ViewAngle(yaw=10.0, pitch=-5.0),
        movement="stand",
        captured=True,
        clickType="left",
    )
    defaults.update(overrides)
    return Waypoint(**defaults)


def make_lineup(**overrides) -> Lineup:
    defaults = dict(
        id="abc",
        mapId="mirage",
        side="T",
        grenadeType="smoke",
        spotName="Window smoke",
        source="manual",
        createdAt="2026-01-01T00:00:00+00:00",
        updatedAt="2026-01-01T00:00:00+00:00",
        waypoints=[make_waypoint()],
    )
    defaults.update(overrides)
    return Lineup(**defaults)


def test_position_round_trip():
    p = Position(x=1.5, y=-2.5, z=0.0)
    assert Position.from_dict(p.to_dict()) == p


def test_waypoint_round_trip():
    wp = make_waypoint(screenshotRef="screenshots/a.png", description="Vise le coin.")
    assert Waypoint.from_dict(wp.to_dict()) == wp


def test_lineup_round_trip():
    lineup = make_lineup(notes="Attention au timing.", favorite=True)
    assert Lineup.from_dict(lineup.to_dict()) == lineup


def test_lineup_round_trip_defaults_from_minimal_dict():
    # from_dict doit tolérer un dict minimal (anciennes données / champs optionnels
    # absents) en retombant sur les valeurs par défaut du modèle.
    minimal = {
        "id": "x",
        "mapId": "dust2",
        "side": "CT",
        "grenadeType": "flash",
        "spotName": "Long flash",
        "source": "manual",
        "createdAt": "2026-01-01T00:00:00+00:00",
        "updatedAt": "2026-01-01T00:00:00+00:00",
    }
    lineup = Lineup.from_dict(minimal)
    assert lineup.category == "standard"
    assert lineup.spawnPoint is None
    assert lineup.notes == ""
    assert lineup.favorite is False
    assert lineup.waypoints == []


def test_map_round_trip():
    m = Map(id="mirage", displayName="Mirage", radarImageRef="radar/mirage.png",
            radarPosX=-3230.0, radarPosY=1713.0, radarScale=5.0)
    assert Map.from_dict(m.to_dict()) == m


def test_map_round_trip_without_calibration():
    m = Map(id="nuke", displayName="Nuke", radarImageRef="radar/nuke.png")
    assert Map.from_dict(m.to_dict()) == m


def test_spawnpoint_round_trip():
    sp = SpawnPoint(id="s1", mapId="mirage", side="T", index=3, position=Position(x=1, y=2, z=3))
    assert SpawnPoint.from_dict(sp.to_dict()) == sp


def test_lineup_throw_label_uses_throw_waypoint_only():
    checkpoint = make_waypoint(order=1, type="checkpoint", movement="run", clickType=None)
    throw = make_waypoint(order=2, type="throw", movement="jump", clickType="left")
    lineup = make_lineup(waypoints=[checkpoint, throw])
    assert lineup.throw_waypoint is throw
    assert lineup.throw_label == "Jumpthrow"


def test_lineup_throw_label_none_without_throw_waypoint():
    lineup = make_lineup(waypoints=[make_waypoint(type="checkpoint")])
    assert lineup.throw_waypoint is None
    assert lineup.throw_label is None


def test_lineup_throw_label_none_without_click_type():
    lineup = make_lineup(waypoints=[make_waypoint(type="throw", clickType=None)])
    assert lineup.throw_label is None


def test_derive_throw_label_stand_and_walk_have_no_prefix():
    assert derive_throw_label("stand", "left") == "Throw"
    assert derive_throw_label("walk", "left") == "Throw"


def test_derive_throw_label_run():
    assert derive_throw_label("run", "left") == "Runthrow"


def test_derive_throw_label_jump():
    assert derive_throw_label("jump", "left") == "Jumpthrow"


def test_derive_throw_label_wjump():
    assert derive_throw_label("wjump", "left") == "W+Jumpthrow"


def test_derive_throw_label_walkrunjump():
    assert derive_throw_label("walkrunjump", "left") == "Walk+Run+Jumpthrow"
