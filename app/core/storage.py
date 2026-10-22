"""Persistance JSON sur disque — voir docs/structure-donnees-lineups.md.

Décision MVP : fichiers JSON plats plutôt qu'une base de données, cohérent avec
les exemples de la doc et suffisant pour un usage mono-utilisateur local.
"""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

from core.models import Lineup, LineupCategory, Map, SpawnPoint


def _bundle_root() -> Path:
    """Racine des assets embarqués en lecture seule (maps.json, seed, radar) — le
    dossier app/ en développement, ou le dossier d'extraction PyInstaller une fois
    empaqueté (`sys._MEIPASS`, présent aussi bien en --onedir qu'en --onefile)."""
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS)
    return Path(__file__).resolve().parent.parent


DATA_DIR = _bundle_root() / "data"
SEED_DIR = DATA_DIR / "seed"
USER_DIR = DATA_DIR / "user"

MAPS_FILE = DATA_DIR / "maps.json"
LINEUPS_FILE = USER_DIR / "lineups.json"
SCREENSHOTS_DIR = USER_DIR / "screenshots"


def configure_user_dir(path: Path) -> None:
    """Redirige le stockage utilisateur inscriptible (lineups + screenshots) vers
    `path`, indépendamment de MAPS_FILE/SEED_DIR (lecture seule, résolus depuis le
    bundle). Utilisé par app/main_consultation.py pour écrire dans un dossier type
    %APPDATA%\\CS2NadeStudioViewer\\ plutôt que dans le dossier d'installation de
    l'exe (souvent en lecture seule une fois empaqueté). Doit être appelé avant tout
    accès aux lineups (avant la création de l'Api)."""
    global USER_DIR, LINEUPS_FILE, SCREENSHOTS_DIR
    USER_DIR = Path(path)
    LINEUPS_FILE = USER_DIR / "lineups.json"
    SCREENSHOTS_DIR = USER_DIR / "screenshots"


def _ensure_seeded(user_path: Path, seed_path: Path) -> None:
    """Initialise un fichier de données utilisateur à partir du seed versionné, une
    seule fois (premier lancement / clone frais). Le build consultation-only n'embarque
    pas de seed (voir CS2 Nade Studio, distribution) — dans ce cas, démarre avec une
    bibliothèque vide plutôt que de planter sur un fichier source manquant."""
    if user_path.exists():
        return
    user_path.parent.mkdir(parents=True, exist_ok=True)
    if seed_path.exists():
        shutil.copyfile(seed_path, user_path)
    else:
        user_path.write_text("[]", encoding="utf-8")


def _load_json(path: Path) -> list:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _save_json(path: Path, data: list) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def load_maps() -> list[Map]:
    return [Map.from_dict(d) for d in _load_json(MAPS_FILE)]


def load_lineups() -> list[Lineup]:
    _ensure_seeded(LINEUPS_FILE, SEED_DIR / "lineups.json")
    return [Lineup.from_dict(d) for d in _load_json(LINEUPS_FILE)]


def save_lineups(lineups: list[Lineup]) -> None:
    _save_json(LINEUPS_FILE, [l.to_dict() for l in lineups])


def add_lineup(lineup: Lineup) -> None:
    lineups = load_lineups()
    lineups.append(lineup)
    save_lineups(lineups)


def load_spawnpoints() -> list[SpawnPoint]:
    # Lu directement depuis le seed, pas de copie côté USER_DIR contrairement à
    # load_lineups() : ces positions sont statiques et fixes par carte (voir
    # structure-donnees-lineups.md), aucun chemin d'écriture n'existe pour cette
    # entité — pas de risque de divergence à gérer entre les deux copies.
    return [SpawnPoint.from_dict(d) for d in _load_json(SEED_DIR / "spawnpoints.json")]


def list_spawnpoints(mapId: str | None = None, side: str | None = None) -> list[SpawnPoint]:
    spawnpoints = load_spawnpoints()
    if mapId is not None:
        spawnpoints = [s for s in spawnpoints if s.mapId == mapId]
    if side is not None:
        spawnpoints = [s for s in spawnpoints if s.side == side]
    return spawnpoints


def get_spawnpoint(spawnpoint_id: str) -> SpawnPoint | None:
    return next((s for s in load_spawnpoints() if s.id == spawnpoint_id), None)


def list_lineups(
    mapId: str | None = None,
    side: str | None = None,
    grenadeType: str | None = None,
    category: LineupCategory | None = None,
) -> list[Lineup]:
    lineups = load_lineups()
    if mapId is not None:
        lineups = [l for l in lineups if l.mapId == mapId]
    if side is not None:
        lineups = [l for l in lineups if l.side == side]
    if grenadeType is not None:
        lineups = [l for l in lineups if l.grenadeType == grenadeType]
    if category is not None:
        lineups = [l for l in lineups if l.category == category]
    return lineups


def get_lineup(lineup_id: str) -> Lineup | None:
    return next((l for l in load_lineups() if l.id == lineup_id), None)


def find_lineup_by_spawn(mapId: str, side: str, category: str, spotName: str, spawnPoint: str) -> Lineup | None:
    """Retrouve le lineup d'un groupe "instant" déjà capturé pour un spawn donné —
    utilisé en édition pour afficher la capture existante d'un spawn plutôt que de
    forcer une recapture quand le spawn choisi est déjà fait (voir CaptureSession)."""
    return next(
        (
            l
            for l in load_lineups()
            if l.mapId == mapId
            and l.side == side
            and l.category == category
            and l.spotName == spotName
            and l.spawnPoint == spawnPoint
        ),
        None,
    )


def update_lineup(lineup_id: str, **updates) -> Lineup | None:
    lineups = load_lineups()
    lineup = next((l for l in lineups if l.id == lineup_id), None)
    if lineup is None:
        return None
    for key, value in updates.items():
        setattr(lineup, key, value)
    save_lineups(lineups)
    return lineup


def delete_lineup(lineup_id: str) -> bool:
    lineups = load_lineups()
    remaining = [l for l in lineups if l.id != lineup_id]
    if len(remaining) == len(lineups):
        return False
    save_lineups(remaining)
    return True


def delete_lineups(lineup_ids: list[str]) -> int:
    """Suppression groupée (sélection multiple) — une seule lecture/écriture plutôt
    qu'un appel à delete_lineup par id."""
    ids = set(lineup_ids)
    lineups = load_lineups()
    remaining = [l for l in lineups if l.id not in ids]
    deleted = len(lineups) - len(remaining)
    if deleted:
        save_lineups(remaining)
    return deleted


def delete_library() -> int:
    """Vide toute la bibliothèque utilisateur : lineups + screenshots. Réécrit une
    liste vide plutôt que de supprimer lineups.json — sinon _ensure_seeded
    réinitialiserait la bibliothèque depuis le seed au prochain chargement."""
    deleted = len(load_lineups())
    save_lineups([])
    if SCREENSHOTS_DIR.exists():
        shutil.rmtree(SCREENSHOTS_DIR)
    SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
    return deleted


def delete_lineup_group(mapId: str, side: str, category: str, spotName: str) -> int:
    """Supprime tous les lineups d'un groupe "instant" (un par spawn) en une seule
    lecture/écriture — même rationale que delete_lineups() pour la sélection multiple."""
    lineups = load_lineups()
    remaining = [
        l
        for l in lineups
        if not (l.mapId == mapId and l.side == side and l.category == category and l.spotName == spotName)
    ]
    deleted = len(lineups) - len(remaining)
    if deleted:
        save_lineups(remaining)
    return deleted
