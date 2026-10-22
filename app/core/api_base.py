"""API pywebview exposée pour la consultation (browse) de la bibliothèque de
lineups — socle commun à l'app complète (`app/main.py::Api`) et au build
consultation-only (`app/main_consultation.py`).

Ce module ne doit importer aucune dépendance capture-only (keyboard, mss,
psutil, core.capture, core.plugin_client) — même transitivement — pour que le
build consultation-only reste léger et fonctionne sans serveur/plugin CS2. Voir
app/tests/test_main_consultation_imports.py qui vérifie cette garantie."""

from __future__ import annotations

import base64
import mimetypes
from pathlib import Path

import webview
from PIL import Image

from core import export_import, storage
from core.image_derivatives import (
    DETAIL_JPEG_QUALITY,
    DETAIL_MAX_WIDTH,
    THUMB_JPEG_QUALITY,
    THUMB_WIDTH,
    save_resized_jpeg,
)
from core.models import Lineup

APP_DIR = Path(__file__).resolve().parent.parent

# Fenêtre principale, assignée par main.py/main_consultation.py une fois créée
# (webview.create_window() ne peut être appelé qu'après l'instanciation de l'Api
# qui lui sert de js_api — voir set_main_window()).
main_window: webview.Window | None = None

_asset_data_url_cache: dict[str, str] = {}
_screenshot_data_url_cache: dict[str, str] = {}
_screenshot_thumb_cache: dict[str, str] = {}
_screenshot_detail_cache: dict[str, str] = {}


def set_main_window(window: webview.Window) -> None:
    global main_window
    main_window = window


def _file_to_data_url(root: Path, relative_path: str, cache: dict[str, str]) -> str | None:
    """Convertit un fichier (relatif à `root`) en data URI base64, en confinant la
    résolution à `root` — évite de dépendre du serveur de fichiers local de pywebview,
    qui bloque la remontée de dossiers ('..')."""
    if relative_path in cache:
        return cache[relative_path]

    path = (root / relative_path).resolve()
    if root.resolve() not in path.parents or not path.is_file():
        return None

    mime_type, _ = mimetypes.guess_type(path.name)
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    data_url = f"data:{mime_type or 'application/octet-stream'};base64,{encoded}"
    cache[relative_path] = data_url
    return data_url


def _derived_screenshot_data_url(
    screenshot_ref: str, suffix: str, max_width: int, quality: int, cache: dict[str, str]
) -> str | None:
    """Comme _file_to_data_url, mais résout un dérivé JPEG allégé du screenshot
    (`<stem><suffix>.jpg`, voir core.image_derivatives), en le générant depuis
    l'original si absent (screenshots capturés avant l'ajout de ce mécanisme)."""
    if screenshot_ref in cache:
        return cache[screenshot_ref]

    original_path = (storage.USER_DIR / screenshot_ref).resolve()
    if storage.USER_DIR.resolve() not in original_path.parents or not original_path.is_file():
        return None

    derived_path = original_path.with_name(f"{original_path.stem}{suffix}.jpg")
    if not derived_path.is_file():
        with Image.open(original_path) as image:
            save_resized_jpeg(image, derived_path, max_width, quality)

    encoded = base64.b64encode(derived_path.read_bytes()).decode("ascii")
    data_url = f"data:image/jpeg;base64,{encoded}"
    cache[screenshot_ref] = data_url
    return data_url


class BrowseApi:
    """Méthodes de lecture/browse exposées à l'UI — aucune interaction jeu/plugin."""

    def get_mode(self) -> str:
        return "consultation"

    # --- Bibliothèque de lineups (Phase 4) ---

    def get_maps(self) -> list[dict]:
        return [m.to_dict() for m in storage.load_maps()]

    def get_asset_data_url(self, relative_path: str) -> str | None:
        """Convertit un chemin d'asset (relatif à app/, ex. 'assets/radar/mirage.png') en
        data URI base64 — évite de dépendre de la résolution de chemins relatifs par le
        serveur local de pywebview, qui bloque la remontée de dossiers ('..')."""
        return _file_to_data_url(APP_DIR, relative_path, _asset_data_url_cache)

    def get_screenshot_data_url(self, screenshot_ref: str) -> str | None:
        """Même mécanisme que get_asset_data_url, mais résolu depuis USER_DIR — les
        screenshots de capture (`screenshotRef`, ex. 'screenshots/<uuid>.png') sont
        stockés hors de app/ (voir core.storage.SCREENSHOTS_DIR)."""
        return _file_to_data_url(storage.USER_DIR, screenshot_ref, _screenshot_data_url_cache)

    def get_screenshot_thumb_data_url(self, screenshot_ref: str) -> str | None:
        """Dérivé JPEG allégé (voir _derived_screenshot_data_url) pour les vignettes de
        la vue groupée "instant smoke" — évite d'envoyer l'original ~8 Mo par vignette."""
        return _derived_screenshot_data_url(
            screenshot_ref, "_thumb", THUMB_WIDTH, THUMB_JPEG_QUALITY, _screenshot_thumb_cache
        )

    def get_screenshot_detail_data_url(self, screenshot_ref: str) -> str | None:
        """Dérivé JPEG allégé (voir _derived_screenshot_data_url) pour l'image principale
        de la vue détail d'un lineup — le crop zoom (get_screenshot_data_url avec
        screenshotZoomRef) reste inchangé pour la vérification précise de l'alignement."""
        return _derived_screenshot_data_url(
            screenshot_ref, "_detail", DETAIL_MAX_WIDTH, DETAIL_JPEG_QUALITY, _screenshot_detail_cache
        )

    def get_spawnpoints(self, mapId=None, side=None) -> list[dict]:
        """Positions de spawn statiques par carte (voir docs/structure-donnees-lineups.md) —
        aucune dépendance au plugin/serveur CS2, nécessaire au browse pur pour afficher
        les groupes "instant smoke" sur le radar (voir renderInstantGroupView, main.js),
        pas seulement au formulaire de capture."""
        return [sp.to_dict() for sp in storage.list_spawnpoints(mapId=mapId, side=side)]

    def get_lineups(self, mapId=None, side=None, grenadeType=None, category=None) -> list[dict]:
        lineups = storage.list_lineups(mapId=mapId, side=side, grenadeType=grenadeType, category=category)
        return [self._lineup_view(l) for l in lineups]

    def get_lineup(self, lineup_id: str) -> dict | None:
        lineup = storage.get_lineup(lineup_id)
        return self._lineup_view(lineup) if lineup else None

    @staticmethod
    def _lineup_view(lineup: Lineup) -> dict:
        data = lineup.to_dict()
        data["throwLabel"] = lineup.throw_label
        return data

    def toggle_favorite(self, lineup_id: str) -> dict:
        lineup = storage.get_lineup(lineup_id)
        if lineup is None:
            return {"status": "error", "message": "Lineup introuvable."}
        updated = storage.update_lineup(lineup_id, favorite=not lineup.favorite)
        return {"status": "ok", "lineup": self._lineup_view(updated)}

    def delete_lineup(self, lineup_id: str) -> dict:
        deleted = storage.delete_lineup(lineup_id)
        return {"status": "deleted" if deleted else "error"}

    def delete_lineups(self, lineup_ids: list[str]) -> dict:
        deleted = storage.delete_lineups(lineup_ids)
        return {"status": "ok", "deleted": deleted}

    def get_library_count(self) -> int:
        """Nombre total de lineups, toutes cartes confondues — pour le message de
        confirmation de delete_library (la liste affichée n'en montre qu'une carte)."""
        return len(storage.load_lineups())

    def delete_library(self) -> dict:
        deleted = storage.delete_library()
        return {"status": "ok", "deleted": deleted}

    def delete_instant_group(self, mapId: str, side: str, spotName: str) -> dict:
        deleted = storage.delete_lineup_group(mapId=mapId, side=side, category="instant", spotName=spotName)
        return {"status": "ok", "deleted": deleted}

    def _export_to_zip(self, lineup_ids: list[str]) -> dict:
        path = main_window.create_file_dialog(
            webview.FileDialog.SAVE, save_filename="lineups.zip", file_types=("Fichiers zip (*.zip)",)
        )
        if not path:
            return {"status": "cancelled"}
        # create_file_dialog renvoie un tuple/liste à un élément en SAVE_DIALOG comme en OPEN_DIALOG.
        dest = path[0] if isinstance(path, (list, tuple)) else path
        return export_import.build_export_zip(lineup_ids, dest)

    def export_lineups(self, lineup_ids: list[str]) -> dict:
        return self._export_to_zip(lineup_ids)

    def export_library(self) -> dict:
        lineup_ids = [l.id for l in storage.load_lineups()]
        return self._export_to_zip(lineup_ids)

    def import_lineups(self) -> dict:
        paths = main_window.create_file_dialog(webview.OPEN_DIALOG, file_types=("Fichiers zip (*.zip)",))
        if not paths:
            return {"status": "cancelled"}
        return export_import.import_lineups_zip(paths[0])
