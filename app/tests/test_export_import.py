import json
import zipfile

import pytest

from core import export_import, storage
from core.models import Lineup, Position, ViewAngle, Waypoint


def make_lineup(id="a", screenshot_ref=None, screenshot_zoom_ref=None, crouch=False, **overrides):
    waypoint = Waypoint(
        order=1,
        type="throw",
        referenceType="both",
        position=Position(x=1, y=2, z=3),
        viewAngle=ViewAngle(yaw=10, pitch=20),
        movement="stand",
        clickType="left",
        crouch=crouch,
        captured=True,
        screenshotRef=screenshot_ref,
        screenshotZoomRef=screenshot_zoom_ref,
    )
    defaults = dict(
        id=id,
        mapId="mirage",
        side="T",
        grenadeType="smoke",
        spotName="Window smoke",
        source="manual",
        createdAt="2026-01-01T00:00:00+00:00",
        updatedAt="2026-01-01T00:00:00+00:00",
        waypoints=[waypoint],
    )
    defaults.update(overrides)
    return Lineup(**defaults)


@pytest.fixture
def isolated_storage(tmp_path, monkeypatch):
    lineups_file = tmp_path / "lineups.json"
    lineups_file.write_text("[]", encoding="utf-8")
    monkeypatch.setattr(storage, "USER_DIR", tmp_path)
    monkeypatch.setattr(storage, "LINEUPS_FILE", lineups_file)
    monkeypatch.setattr(storage, "SCREENSHOTS_DIR", tmp_path / "screenshots")
    return tmp_path


def write_screenshot(user_dir, name, content=b"\x89PNG fake"):
    path = user_dir / "screenshots" / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    return f"screenshots/{name}"


# --- build_export_zip ---


def test_build_export_zip_includes_lineup_and_screenshot(isolated_storage, tmp_path):
    ref = write_screenshot(isolated_storage, "shot.png")
    storage.add_lineup(make_lineup(id="a", screenshot_ref=ref))
    dest = tmp_path / "export.zip"

    result = export_import.build_export_zip(["a"], str(dest))

    assert result == {"status": "ok", "count": 1, "missingScreenshots": 0}
    with zipfile.ZipFile(dest) as zf:
        names = zf.namelist()
        assert "manifest.json" in names
        assert "lineups.json" in names
        assert "screenshots/shot.png" in names
        manifest = json.loads(zf.read("manifest.json"))
        assert manifest["format"] == "cs2-nade-studio-lineups"
        lineups = json.loads(zf.read("lineups.json"))
        assert lineups[0]["id"] == "a"
        assert zf.read("screenshots/shot.png") == b"\x89PNG fake"


def test_build_export_zip_filters_to_requested_ids(isolated_storage, tmp_path):
    storage.add_lineup(make_lineup(id="a"))
    storage.add_lineup(make_lineup(id="b"))
    dest = tmp_path / "export.zip"

    result = export_import.build_export_zip(["b"], str(dest))

    assert result["count"] == 1
    with zipfile.ZipFile(dest) as zf:
        lineups = json.loads(zf.read("lineups.json"))
        assert [l["id"] for l in lineups] == ["b"]


def test_build_export_zip_missing_screenshot_on_disk(isolated_storage, tmp_path):
    storage.add_lineup(make_lineup(id="a", screenshot_ref="screenshots/gone.png"))
    dest = tmp_path / "export.zip"

    result = export_import.build_export_zip(["a"], str(dest))

    assert result == {"status": "ok", "count": 1, "missingScreenshots": 1}
    with zipfile.ZipFile(dest) as zf:
        assert "screenshots/gone.png" not in zf.namelist()
        lineups = json.loads(zf.read("lineups.json"))
        # le ref reste dans le JSON même si le fichier n'a pas pu être copié
        assert lineups[0]["waypoints"][0]["screenshotRef"] == "screenshots/gone.png"


def test_build_export_zip_no_screenshot_ref(isolated_storage, tmp_path):
    storage.add_lineup(make_lineup(id="a", screenshot_ref=None))
    dest = tmp_path / "export.zip"

    result = export_import.build_export_zip(["a"], str(dest))

    assert result == {"status": "ok", "count": 1, "missingScreenshots": 0}


# --- import_lineups_zip ---


def _write_zip(path, manifest, lineups, screenshots=None):
    with zipfile.ZipFile(path, "w") as zf:
        if manifest is not None:
            zf.writestr("manifest.json", json.dumps(manifest))
        zf.writestr("lineups.json", json.dumps(lineups))
        for name, content in (screenshots or {}).items():
            zf.writestr(f"screenshots/{name}", content)


def test_import_lineups_zip_assigns_new_ids_and_screenshot_names(isolated_storage, tmp_path):
    src = tmp_path / "src.zip"
    lineup_dict = make_lineup(id="original-id", screenshot_ref="screenshots/orig.png").to_dict()
    _write_zip(
        src,
        {"format": "cs2-nade-studio-lineups", "version": 1},
        [lineup_dict],
        screenshots={"orig.png": b"\x89PNG orig"},
    )

    result = export_import.import_lineups_zip(str(src))

    assert result == {"status": "ok", "imported": 1, "skipped": 0, "warnings": []}
    imported = storage.load_lineups()
    assert len(imported) == 1
    assert imported[0].id != "original-id"
    new_ref = imported[0].waypoints[0].screenshotRef
    assert new_ref != "screenshots/orig.png"
    assert (isolated_storage / new_ref).read_bytes() == b"\x89PNG orig"


def test_import_lineups_zip_reimport_creates_independent_copy(isolated_storage, tmp_path):
    src = tmp_path / "src.zip"
    lineup_dict = make_lineup(id="original-id", screenshot_ref="screenshots/orig.png").to_dict()
    _write_zip(
        src,
        {"format": "cs2-nade-studio-lineups", "version": 1},
        [lineup_dict],
        screenshots={"orig.png": b"\x89PNG orig"},
    )

    export_import.import_lineups_zip(str(src))
    export_import.import_lineups_zip(str(src))

    lineups = storage.load_lineups()
    assert len(lineups) == 2
    assert lineups[0].id != lineups[1].id
    assert lineups[0].waypoints[0].screenshotRef != lineups[1].waypoints[0].screenshotRef


def test_import_lineups_zip_missing_screenshot_in_archive_nulls_ref(isolated_storage, tmp_path):
    src = tmp_path / "src.zip"
    lineup_dict = make_lineup(id="a", screenshot_ref="screenshots/missing.png").to_dict()
    _write_zip(src, {"format": "cs2-nade-studio-lineups", "version": 1}, [lineup_dict])

    result = export_import.import_lineups_zip(str(src))

    assert result["status"] == "ok"
    assert result["imported"] == 1
    assert len(result["warnings"]) == 1
    imported = storage.load_lineups()
    assert imported[0].waypoints[0].screenshotRef is None


def test_import_lineups_zip_invalid_manifest_rejected(isolated_storage, tmp_path):
    src = tmp_path / "src.zip"
    _write_zip(src, {"format": "something-else", "version": 1}, [])

    result = export_import.import_lineups_zip(str(src))

    assert result["status"] == "error"
    assert storage.load_lineups() == []


def test_import_lineups_zip_missing_manifest_rejected(isolated_storage, tmp_path):
    src = tmp_path / "src.zip"
    _write_zip(src, None, [])

    result = export_import.import_lineups_zip(str(src))

    assert result["status"] == "error"


def test_import_lineups_zip_not_a_zip_file(isolated_storage, tmp_path):
    src = tmp_path / "not-a-zip.zip"
    src.write_text("plain text, not a zip")

    result = export_import.import_lineups_zip(str(src))

    assert result["status"] == "error"


def test_import_lineups_zip_skips_corrupt_entry_keeps_rest(isolated_storage, tmp_path):
    src = tmp_path / "src.zip"
    good = make_lineup(id="good").to_dict()
    corrupt = {"id": "bad"}  # champs requis manquants
    _write_zip(src, {"format": "cs2-nade-studio-lineups", "version": 1}, [good, corrupt])

    result = export_import.import_lineups_zip(str(src))

    assert result["status"] == "ok"
    assert result["imported"] == 1
    assert result["skipped"] == 1
    assert len(storage.load_lineups()) == 1


def test_import_lineups_zip_preserves_lineup_fields(isolated_storage, tmp_path):
    src = tmp_path / "src.zip"
    lineup_dict = make_lineup(id="a", spotName="Long A window", notes="test note").to_dict()
    _write_zip(src, {"format": "cs2-nade-studio-lineups", "version": 1}, [lineup_dict])

    export_import.import_lineups_zip(str(src))

    imported = storage.load_lineups()[0]
    assert imported.spotName == "Long A window"
    assert imported.notes == "test note"


def test_import_lineups_zip_preserves_crouch(isolated_storage, tmp_path):
    src = tmp_path / "src.zip"
    lineup_dict = make_lineup(id="a", crouch=True).to_dict()
    _write_zip(src, {"format": "cs2-nade-studio-lineups", "version": 1}, [lineup_dict])

    export_import.import_lineups_zip(str(src))

    imported = storage.load_lineups()[0]
    assert imported.waypoints[0].crouch is True
