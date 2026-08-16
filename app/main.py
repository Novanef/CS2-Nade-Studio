"""Point d'entrée de l'application — fenêtre principale + overlay + hotkeys F9/F6.

Voir docs/architecture-technique-lineups.md pour la vue d'ensemble des composants.
"""

from __future__ import annotations

import base64
import ctypes
import mimetypes
import os
import threading
import time
from pathlib import Path

import keyboard
import webview
from PIL import Image

from core import capture as core_capture
from core import plugin_client, storage
from core.capture import CaptureSession, new_lineup_dict
from core.models import Lineup
from core.plugin_client import PluginUnavailableError

APP_DIR = Path(__file__).resolve().parent
REPO_ROOT = APP_DIR.parent


def _load_env_file(path: Path) -> None:
    """Charge un fichier .env minimal (KEY=VALUE par ligne, # pour les commentaires) dans
    os.environ, sans dépendance externe (python-dotenv) pour un unique fichier à la racine
    du repo — voir .env. N'écrase jamais une variable déjà présente dans l'environnement."""
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


_load_env_file(REPO_ROOT / ".env")

capture_session = CaptureSession()
main_window: webview.Window | None = None
overlay_window: webview.Window | None = None

# Valeur HideHUD d'origine pendant que le HUD est masqué manuellement (bouton
# "Masquer le HUD"), None sinon — voir Api.toggle_hud(). Timing d'application côté
# client jugé trop imprévisible pour être déclenché automatiquement à chaque
# capture F9 (voir CLAUDE.md), donc ce bouton permet de le tester à la main.
_hud_hidden_original: dict | None = None

_asset_data_url_cache: dict[str, str] = {}
_screenshot_data_url_cache: dict[str, str] = {}
_screenshot_thumb_cache: dict[str, str] = {}
_screenshot_detail_cache: dict[str, str] = {}

# Overlay affiché seulement quand le serveur + un joueur sont connectés — état
# géré par _poll_overlay_visibility(), voir main().
_overlay_visible = False
_stop_overlay_polling = threading.Event()
OVERLAY_POLL_INTERVAL_SECONDS = 1.5

# Lineup actuellement consulté dans la fenêtre principale, synchronisé depuis le JS
# (Api.set_active_lineup) — utilisé par F6 (on_test_hotkey) pour téléporter vers ce
# lineup quand aucune capture n'est en cours.
_active_lineup_id: str | None = None


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
    (`<stem><suffix>.jpg`, ex. '_thumb'/'_detail' — voir core.capture._save_resized_jpeg),
    en le générant depuis l'original si absent (screenshots capturés avant l'ajout de ce
    mécanisme). Évite d'envoyer l'original ~8 Mo à travers le pont IPC pywebview à chaque
    sélection de lineup, alors que l'UI n'affiche jamais l'image à sa pleine résolution."""
    if screenshot_ref in cache:
        return cache[screenshot_ref]

    original_path = (storage.USER_DIR / screenshot_ref).resolve()
    if storage.USER_DIR.resolve() not in original_path.parents or not original_path.is_file():
        return None

    derived_path = original_path.with_name(f"{original_path.stem}{suffix}.jpg")
    if not derived_path.is_file():
        with Image.open(original_path) as image:
            core_capture._save_resized_jpeg(image, derived_path, max_width, quality)

    encoded = base64.b64encode(derived_path.read_bytes()).decode("ascii")
    data_url = f"data:image/jpeg;base64,{encoded}"
    cache[screenshot_ref] = data_url
    return data_url


class Api:
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
            screenshot_ref,
            "_thumb",
            core_capture._THUMB_WIDTH,
            core_capture._THUMB_JPEG_QUALITY,
            _screenshot_thumb_cache,
        )

    def get_screenshot_detail_data_url(self, screenshot_ref: str) -> str | None:
        """Dérivé JPEG allégé (voir _derived_screenshot_data_url) pour l'image principale
        de la vue détail d'un lineup — le crop zoom (get_screenshot_data_url avec
        screenshotZoomRef) reste inchangé pour la vérification précise de l'alignement."""
        return _derived_screenshot_data_url(
            screenshot_ref,
            "_detail",
            core_capture._DETAIL_MAX_WIDTH,
            core_capture._DETAIL_JPEG_QUALITY,
            _screenshot_detail_cache,
        )

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

    def update_lineup(self, lineup_id: str, spotName: str, notes: str = "") -> dict:
        from datetime import datetime, timezone

        spotName = spotName.strip()
        if not spotName:
            return {"status": "error", "message": "Le nom du spot est requis."}

        updated = storage.update_lineup(
            lineup_id,
            spotName=spotName,
            notes=notes,
            updatedAt=datetime.now(timezone.utc).isoformat(),
        )
        if updated is None:
            return {"status": "error", "message": "Lineup introuvable."}
        return {"status": "saved", "lineup": self._lineup_view(updated)}

    def delete_lineup(self, lineup_id: str) -> dict:
        deleted = storage.delete_lineup(lineup_id)
        return {"status": "deleted" if deleted else "error"}

    def set_active_lineup(self, lineup_id: str | None) -> None:
        """Synchronise le lineup actuellement consulté dans l'UI — F6 (on_test_hotkey)
        téléporte vers ce lineup quand aucune capture n'est en cours."""
        global _active_lineup_id
        _active_lineup_id = lineup_id

    # --- Capture via plugin (Phase 5) ---

    def start_capture(
        self,
        mapId,
        side,
        grenadeType,
        spotName,
        notes="",
        movement="stand",
        clickType="left",
        category="standard",
        spawnPoint=None,
    ) -> dict:
        draft = capture_session.start(
            mapId=mapId,
            side=side,
            grenadeType=grenadeType,
            spotName=spotName,
            notes=notes,
            movement=movement,
            clickType=clickType,
            category=category,
            spawnPoint=spawnPoint,
        )
        set_overlay_status("ready")
        return {"status": "started", "spotName": draft.spotName}

    def get_spawnpoints(self, mapId=None, side=None) -> list[dict]:
        return [sp.to_dict() for sp in storage.list_spawnpoints(mapId=mapId, side=side)]

    def teleport_to_spawn(self, spawnpoint_id: str) -> dict:
        spawnpoint = storage.get_spawnpoint(spawnpoint_id)
        if spawnpoint is None:
            return {"status": "error", "message": "Spawn introuvable."}

        try:
            server_map = plugin_client.get_map_name()
        except PluginUnavailableError:
            return {"status": "error", "message": "Plugin inaccessible."}
        expected_map = f"de_{spawnpoint.mapId}"
        if server_map != expected_map:
            return {
                "status": "error",
                "message": f"Le serveur est sur {server_map or '?'}, pas {expected_map} — change de carte avant de te téléporter.",
            }

        try:
            positions = plugin_client.get_player_positions()
            if any(p.get("isBot") for p in positions):
                # bot_kick sans argument vire tous les bots d'un coup (comportement
                # standard du moteur Source) — un bot resté sur un spawn ferait
                # atterrir le joueur sur lui à la téléportation.
                plugin_client.run_command("bot_kick")
        except PluginUnavailableError:
            return {"status": "error", "message": "Plugin inaccessible."}

        try:
            current = plugin_client.get_position()
        except PluginUnavailableError:
            return {"status": "error", "message": "Plugin inaccessible."}
        if current is None:
            return {"status": "error", "message": "Aucun joueur trouvé sur le serveur."}

        ok = plugin_client.teleport(
            x=spawnpoint.position.x,
            y=spawnpoint.position.y,
            z=spawnpoint.position.z,
            pitch=current["pitch"],
            yaw=current["yaw"],
        )
        return {"status": "ok" if ok else "error"}

    def cancel_capture(self) -> dict:
        capture_session.cancel()
        set_overlay_status("idle")
        return {"status": "cancelled"}

    def get_capture_draft(self) -> dict | None:
        draft = capture_session.draft
        if draft is None:
            return None
        return {
            "mapId": draft.mapId,
            "side": draft.side,
            "grenadeType": draft.grenadeType,
            "spotName": draft.spotName,
            "notes": draft.notes,
            "movement": draft.movement,
            "clickType": draft.clickType,
            "waypoint": draft.waypoint.to_dict() if draft.waypoint else None,
        }

    def save_capture(self) -> dict:
        if capture_session.draft is None or capture_session.draft.waypoint is None:
            return {"status": "error", "message": "Aucun waypoint capturé à sauvegarder."}
        if not capture_session.draft.spotName.strip():
            return {"status": "error", "message": "Le nom du spot est requis."}

        lineup_dict = new_lineup_dict(capture_session.draft, source="plugin_capture")
        storage.add_lineup(Lineup.from_dict(lineup_dict))
        capture_session.cancel()
        set_overlay_status("idle")
        return {"status": "saved", "lineup": lineup_dict}

    # --- Bascule HUD manuelle (test du timing d'application, voir CLAUDE.md) ---

    def toggle_hud(self) -> dict:
        global _hud_hidden_original

        if _hud_hidden_original is not None:
            try:
                plugin_client.restore_capture(_hud_hidden_original)
            except PluginUnavailableError:
                return {"status": "error", "message": "Plugin inaccessible"}
            _hud_hidden_original = None
            return {"status": "shown"}

        try:
            original = plugin_client.prepare_capture()
        except PluginUnavailableError:
            return {"status": "error", "message": "Plugin inaccessible"}
        if original is None:
            return {"status": "no_player", "message": "Aucun joueur trouvé sur le serveur"}

        _hud_hidden_original = original
        return {"status": "hidden"}


def set_overlay_status(state: str, message: str = "") -> None:
    if overlay_window is None:
        return
    try:
        overlay_window.evaluate_js(f"window.setStatus({state!r}, {message!r})")
    except Exception:
        pass  # la fenêtre overlay n'est peut-être pas encore chargée


def on_capture_hotkey() -> None:
    set_overlay_status("capturing")
    try:
        result = capture_session.capture_now()
    except PluginUnavailableError:
        set_overlay_status("error", "Plugin inaccessible")
        return

    if result["status"] == "captured":
        set_overlay_status("captured")
    elif result["status"] == "no_player":
        set_overlay_status("error", "Aucun joueur trouvé sur le serveur")
    else:
        set_overlay_status("error", "Aucun lineup en cours de création")

    if main_window is not None:
        try:
            main_window.evaluate_js("window.onCaptureUpdated && window.onCaptureUpdated()")
        except Exception:
            pass


def _teleport_to_lineup(lineup_id: str) -> dict:
    """Téléporte vers le point de lancer d'un lineup enregistré de la bibliothèque
    (par opposition à test_now(), qui teste le draft de capture en cours). Reprend
    la vérification de carte + kick des bots de Api.teleport_to_spawn — sans ça, un
    mauvais mapping silencieux ou un atterrissage sur un bot serait pire que le code
    en plus."""
    lineup = storage.get_lineup(lineup_id)
    if lineup is None:
        return {"status": "error", "message": "Lineup introuvable."}
    wp = lineup.throw_waypoint
    if wp is None:
        return {"status": "error", "message": "Ce lineup n'a pas de point de lancer."}

    try:
        server_map = plugin_client.get_map_name()
    except PluginUnavailableError:
        return {"status": "error", "message": "Plugin inaccessible."}
    expected_map = f"de_{lineup.mapId}"
    if server_map != expected_map:
        return {
            "status": "error",
            "message": f"Le serveur est sur {server_map or '?'}, pas {expected_map}.",
        }

    try:
        positions = plugin_client.get_player_positions()
        if any(p.get("isBot") for p in positions):
            plugin_client.run_command("bot_kick")
    except PluginUnavailableError:
        return {"status": "error", "message": "Plugin inaccessible."}

    ok = plugin_client.teleport(
        x=wp.position.x,
        y=wp.position.y,
        z=wp.position.z,
        pitch=wp.viewAngle.pitch,
        yaw=wp.viewAngle.yaw,
    )
    return {"status": "ok" if ok else "error"}


def on_test_hotkey() -> None:
    if capture_session.draft is not None and capture_session.draft.waypoint is not None:
        try:
            result = capture_session.test_now()
        except PluginUnavailableError:
            set_overlay_status("error", "Plugin inaccessible")
            return

        if result["status"] == "teleported":
            set_overlay_status("captured", "Téléporté au point de lancer")
        else:
            set_overlay_status("error", "Aucun waypoint capturé")
        return

    if _active_lineup_id is None:
        set_overlay_status("error", "Aucun lineup sélectionné")
        return

    result = _teleport_to_lineup(_active_lineup_id)
    if result["status"] == "ok":
        set_overlay_status("captured", "Téléporté au lineup")
    else:
        set_overlay_status("error", result.get("message", "Erreur"))


def _poll_overlay_visibility() -> None:
    """Affiche/masque l'overlay selon que le serveur + un joueur sont connectés —
    tourne dans un thread démon dédié, sur le même principe que le thread interne de
    `keyboard.add_hotkey(...)` déjà utilisé dans ce fichier. `webview.Window.show()`/
    `.hide()` peuvent être appelés depuis un thread autre que celui de la GUI, comme
    `evaluate_js` l'est déjà depuis le callback thread de `keyboard`."""
    global _overlay_visible
    while not _stop_overlay_polling.is_set():
        connected = plugin_client.is_player_connected()
        if connected != _overlay_visible:
            _overlay_visible = connected
            if overlay_window is not None:
                try:
                    overlay_window.show() if connected else overlay_window.hide()
                except Exception:
                    pass
        _stop_overlay_polling.wait(OVERLAY_POLL_INTERVAL_SECONDS)


def get_screen_size() -> tuple[int, int]:
    user32 = ctypes.windll.user32
    return user32.GetSystemMetrics(0), user32.GetSystemMetrics(1)


_UI_WATCH_EXTENSIONS = {".html", ".js", ".css"}


def _ui_file_mtimes(root: Path) -> dict[Path, float]:
    return {p: p.stat().st_mtime for p in root.rglob("*") if p.suffix in _UI_WATCH_EXTENSIONS}


def _watch_ui_and_reload(window: webview.Window, index_path: Path, poll_interval: float = 0.5) -> None:
    """Recharge `window` dès qu'un fichier HTML/JS/CSS sous le dossier de `index_path`
    est modifié — évite de relancer l'app à chaque changement d'UI en développement.
    Activé uniquement si NADE_STUDIO_HOT_RELOAD=1 (voir main()) : un rechargement complet
    réinitialise l'état JS de la fenêtre, ce qu'on ne veut jamais pendant une vraie
    session de capture."""
    root = index_path.parent
    last_mtimes = _ui_file_mtimes(root)
    while True:
        time.sleep(poll_interval)
        current_mtimes = _ui_file_mtimes(root)
        if current_mtimes != last_mtimes:
            last_mtimes = current_mtimes
            try:
                window.load_url(str(index_path))
            except Exception:
                pass


def main() -> None:
    global main_window, overlay_window

    api = Api()
    main_window_index = APP_DIR / "ui" / "main_window" / "index.html"
    main_window = webview.create_window(
        "CS2 Nade Studio",
        str(main_window_index),
        js_api=api,
        width=1000,
        height=720,
    )

    screen_w, screen_h = get_screen_size()
    overlay_w, overlay_h = 240, 100
    margin = 24
    overlay_window_index = APP_DIR / "ui" / "overlay" / "index.html"
    overlay_window = webview.create_window(
        "CS2 Nade Studio — Overlay",
        str(overlay_window_index),
        frameless=True,
        on_top=True,
        hidden=True,  # caché tant que _poll_overlay_visibility n'a pas confirmé une connexion —
        # .hide() ne peut pas être appelé ici, la fenêtre native n'existe pas encore
        # avant webview.start() (WebViewException: "Main window failed to start")
        width=overlay_w,
        height=overlay_h,
        x=screen_w - overlay_w - margin,
        y=screen_h - overlay_h - margin,
    )

    keyboard.add_hotkey("f9", on_capture_hotkey)
    # F10 est par défaut lié à "quitter le jeu" (cs_quit_prompt) dans de nombreuses
    # configurations CS2 — F6 évite ce conflit.
    keyboard.add_hotkey("f6", on_test_hotkey)

    def _start_background_threads() -> None:
        threading.Thread(target=_poll_overlay_visibility, daemon=True).start()
        if os.environ.get("NADE_STUDIO_HOT_RELOAD") == "1":
            threading.Thread(
                target=_watch_ui_and_reload, args=(main_window, main_window_index), daemon=True
            ).start()
            threading.Thread(
                target=_watch_ui_and_reload, args=(overlay_window, overlay_window_index), daemon=True
            ).start()

    # Démarré via func= plutôt qu'avant webview.start() : les fenêtres natives ne sont
    # créées qu'au démarrage de la boucle webview, appeler .show()/.hide() avant (même
    # depuis un thread séparé lancé trop tôt) lève WebViewException("Main window failed
    # to start").
    webview.start(_start_background_threads, debug=False)


if __name__ == "__main__":
    main()
