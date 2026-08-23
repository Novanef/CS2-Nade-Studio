"""Export/import de lineups vers/depuis un fichier .zip portable (coordonnées +
screenshots) — voir CLAUDE.md pour le format et les règles de remapping d'id."""

from __future__ import annotations

import json
import uuid
import zipfile

from core import storage
from core.models import Lineup

MANIFEST_FORMAT = "cs2-nade-studio-lineups"
MANIFEST_VERSION = 1


def build_export_zip(lineup_ids: list[str], dest_path: str) -> dict:
    lineups = [l for l in storage.load_lineups() if l.id in set(lineup_ids)]

    missing_screenshots = 0
    try:
        with zipfile.ZipFile(dest_path, "w") as zf:
            zf.writestr(
                "manifest.json",
                json.dumps({"format": MANIFEST_FORMAT, "version": MANIFEST_VERSION, "count": len(lineups)}),
            )
            zf.writestr("lineups.json", json.dumps([l.to_dict() for l in lineups]))

            for lineup in lineups:
                for wp in lineup.waypoints:
                    for ref in (wp.screenshotRef, wp.screenshotZoomRef):
                        if ref is None:
                            continue
                        source_path = storage.USER_DIR / ref
                        if not source_path.is_file():
                            missing_screenshots += 1
                            continue
                        zf.write(source_path, ref)
    except OSError as exc:
        return {"status": "error", "message": str(exc)}

    return {"status": "ok", "count": len(lineups), "missingScreenshots": missing_screenshots}


def import_lineups_zip(zip_path: str) -> dict:
    try:
        zf = zipfile.ZipFile(zip_path)
    except (OSError, zipfile.BadZipFile):
        return {"status": "error", "message": "Fichier invalide."}

    with zf:
        manifest_raw = _read_optional(zf, "manifest.json")
        if manifest_raw is None:
            return {"status": "error", "message": "Fichier invalide."}
        try:
            manifest = json.loads(manifest_raw)
        except json.JSONDecodeError:
            return {"status": "error", "message": "Fichier invalide."}
        if manifest.get("format") != MANIFEST_FORMAT:
            return {"status": "error", "message": "Fichier invalide."}

        lineups_raw = _read_optional(zf, "lineups.json")
        if lineups_raw is None:
            return {"status": "error", "message": "Fichier invalide."}
        try:
            entries = json.loads(lineups_raw)
        except json.JSONDecodeError:
            return {"status": "error", "message": "Fichier invalide."}
        if not isinstance(entries, list):
            return {"status": "error", "message": "Fichier invalide."}

        archive_names = set(zf.namelist())
        imported: list[Lineup] = []
        skipped = 0
        warnings: list[str] = []

        for entry in entries:
            try:
                lineup = Lineup.from_dict(entry)
            except (KeyError, TypeError):
                skipped += 1
                continue

            lineup.id = str(uuid.uuid4())
            for wp in lineup.waypoints:
                wp.screenshotRef = _import_screenshot(zf, wp.screenshotRef, archive_names, warnings)
                wp.screenshotZoomRef = _import_screenshot(zf, wp.screenshotZoomRef, archive_names, warnings)

            imported.append(lineup)

    if imported:
        lineups = storage.load_lineups()
        lineups.extend(imported)
        storage.save_lineups(lineups)

    return {"status": "ok", "imported": len(imported), "skipped": skipped, "warnings": warnings}


def _read_optional(zf: zipfile.ZipFile, name: str) -> bytes | None:
    try:
        return zf.read(name)
    except KeyError:
        return None


def _import_screenshot(
    zf: zipfile.ZipFile, ref: str | None, archive_names: set[str], warnings: list[str]
) -> str | None:
    if ref is None:
        return None
    if ref not in archive_names:
        warnings.append(f"Capture manquante dans l'archive : {ref}")
        return None

    suffix = "".join(_ref_suffix_parts(ref))
    new_name = f"{uuid.uuid4()}{suffix}"
    storage.SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
    (storage.SCREENSHOTS_DIR / new_name).write_bytes(zf.read(ref))
    return f"screenshots/{new_name}"


def _ref_suffix_parts(ref: str):
    """Distingue 'screenshots/<uuid>_zoom.png' de 'screenshots/<uuid>.png' pour
    reconstituer un suffixe ('_zoom.png' ou '.png') autour du nouveau nom généré."""
    filename = ref.rsplit("/", 1)[-1]
    if "_zoom." in filename:
        _, _, ext = filename.rpartition("_zoom.")
        return ("_zoom.", ext)
    _, _, ext = filename.rpartition(".")
    return (".", ext)
