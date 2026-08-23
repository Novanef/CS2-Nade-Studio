"""Point d'entrée de l'application — fenêtre principale + overlay + hotkeys F9/F6.

Voir docs/architecture-technique-lineups.md pour la vue d'ensemble des composants.
"""

from __future__ import annotations

import ctypes
import json
import os
import threading
import time
from pathlib import Path

import keyboard
import webview

from core import api_base, plugin_client, storage
from core.api_base import BrowseApi
from core.capture import CaptureSession, new_lineup_dict, updated_lineup_fields
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

# Overlay affiché seulement quand le serveur + un joueur sont connectés — état
# géré par _poll_overlay_visibility(), voir main().
_overlay_visible = False
_stop_overlay_polling = threading.Event()
OVERLAY_POLL_INTERVAL_SECONDS = 1.5

# Dernière map serveur connue, relevée par le même thread de polling — poussée à la
# fenêtre principale (badge #serverMapBadge) uniquement quand elle change, voir
# _poll_overlay_visibility().
_server_map_name: str | None = None

# Lineup actuellement consulté dans la fenêtre principale, synchronisé depuis le JS
# (Api.set_active_lineup) — utilisé par F6 (on_test_hotkey) pour téléporter vers ce
# lineup quand aucune capture n'est en cours.
_active_lineup_id: str | None = None

# mapId attendu par le dernier mismatch de map détecté dans _teleport_to_lineup —
# permet à F7 (on_fix_map_hotkey) de changer la map sans repasser par le clavier
# pour retaper son nom (voir aussi la commande chat .changelevel côté plugin).
_pending_map_fix: str | None = None


class Api(BrowseApi):
    def get_mode(self) -> str:
        return "full"

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
        crouch=False,
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
            crouch=crouch,
            category=category,
            spawnPoint=spawnPoint,
        )
        set_overlay_status("ready")
        return self._draft_view(draft)

    def start_edit_capture(self, lineup_id: str) -> dict:
        """Réutilise le formulaire de création en mode édition (bouton Éditer) —
        pré-remplit le draft avec les données du lineup existant."""
        lineup = storage.get_lineup(lineup_id)
        if lineup is None:
            return {"status": "error", "message": "Lineup introuvable."}
        capture_session.start_edit(lineup)
        set_overlay_status("ready")
        return {"status": "started"}

    def update_capture_fields(
        self,
        mapId,
        side,
        grenadeType,
        spotName,
        notes,
        movement,
        clickType,
        crouch,
        category,
        spawnPoint,
    ) -> dict:
        draft = capture_session.draft
        # En édition d'un lineup "instant", choisir un spawn déjà capturé par un
        # autre lineup du même groupe bascule l'édition sur ce lineup-là (affiche
        # sa capture existante) plutôt que d'effacer le waypoint courant — voir
        # CaptureSession.update_fields pour le cas d'un spawn encore vide.
        if (
            draft is not None
            and draft.editingLineupId is not None
            and category == "instant"
            and spawnPoint is not None
            and spawnPoint != draft.spawnPoint
        ):
            sibling = storage.find_lineup_by_spawn(
                mapId=mapId, side=side, category="instant", spotName=spotName, spawnPoint=spawnPoint
            )
            if sibling is not None and sibling.id != draft.editingLineupId:
                capture_session.start_edit(sibling)
                set_overlay_status("ready")
                return self._draft_view(capture_session.draft)

        draft = capture_session.update_fields(
            mapId=mapId,
            side=side,
            grenadeType=grenadeType,
            spotName=spotName,
            notes=notes,
            movement=movement,
            clickType=clickType,
            crouch=crouch,
            category=category,
            spawnPoint=spawnPoint,
        )
        return self._draft_view(draft)

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
                "expectedMapId": spawnpoint.mapId,
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

    def change_server_map(self, map_id: str) -> dict:
        """Recharge le serveur sur `map_id` (bouton "Changer de map" affiché en cas de
        mismatch). Ne bloque pas jusqu'à ce que la carte soit chargée — le changelevel
        prend plusieurs secondes côté serveur, c'est à l'appelant de retenter la
        téléportation une fois prêt."""
        try:
            plugin_client.change_map(map_id)
        except PluginUnavailableError:
            return {"status": "error", "message": "Plugin inaccessible."}
        return {"status": "ok"}

    def get_server_map_name(self) -> str | None:
        try:
            return plugin_client.get_map_name()
        except PluginUnavailableError:
            return None

    def cancel_capture(self) -> dict:
        capture_session.cancel()
        set_overlay_status("idle")
        return {"status": "cancelled"}

    @staticmethod
    def _draft_view(draft) -> dict | None:
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
            "crouch": draft.crouch,
            "category": draft.category,
            "spawnPoint": draft.spawnPoint,
            "waypoint": draft.waypoint.to_dict() if draft.waypoint else None,
            "editingLineupId": draft.editingLineupId,
        }

    def get_capture_draft(self) -> dict | None:
        return self._draft_view(capture_session.draft)

    def save_capture(self) -> dict:
        draft = capture_session.draft
        if draft is None or draft.waypoint is None:
            return {"status": "error", "message": "Aucun waypoint capturé à sauvegarder."}
        if not draft.spotName.strip():
            return {"status": "error", "message": "Le nom du spot est requis."}

        if draft.editingLineupId is not None:
            updated = storage.update_lineup(draft.editingLineupId, **updated_lineup_fields(draft))
            capture_session.cancel()
            set_overlay_status("idle")
            if updated is None:
                return {"status": "error", "message": "Lineup introuvable (supprimé entre-temps ?)."}
            return {"status": "saved", "lineup": self._lineup_view(updated)}

        lineup_dict = new_lineup_dict(draft, source="plugin_capture")
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
    global _pending_map_fix
    expected_map = f"de_{lineup.mapId}"
    if server_map != expected_map:
        _pending_map_fix = lineup.mapId
        # Message affiché sur l'overlay (panneau opaque de taille fixe, voir CLAUDE.md) —
        # doit rester très court pour ne pas déborder et faire apparaître une scrollbar.
        # Le détail (F7 / .changelevel) est déjà dans le rappel de hotkeys de l'overlay.
        return {
            "status": "error",
            "message": f"Mauvaise map ({server_map or '?'})",
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
    if ok:
        _pending_map_fix = None
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


def on_fix_map_hotkey() -> None:
    """F7 — change la map serveur vers celle attendue par le dernier mismatch
    détecté par _teleport_to_lineup, sans avoir à ouvrir le chat (voir aussi la
    commande .changelevel côté plugin, pour changer vers une map arbitraire)."""
    global _pending_map_fix
    if _pending_map_fix is None:
        set_overlay_status("error", "Rien à corriger")
        return

    map_id = _pending_map_fix
    try:
        plugin_client.change_map(map_id)
    except PluginUnavailableError:
        set_overlay_status("error", "Plugin inaccessible")
        return

    _pending_map_fix = None
    set_overlay_status("captured", f"Chargement de_{map_id}…")


def _poll_overlay_visibility() -> None:
    """Affiche/masque l'overlay selon que le serveur + un joueur sont connectés —
    tourne dans un thread démon dédié, sur le même principe que le thread interne de
    `keyboard.add_hotkey(...)` déjà utilisé dans ce fichier. `webview.Window.show()`/
    `.hide()` peuvent être appelés depuis un thread autre que celui de la GUI, comme
    `evaluate_js` l'est déjà depuis le callback thread de `keyboard`."""
    global _overlay_visible, _server_map_name
    while not _stop_overlay_polling.is_set():
        connected = plugin_client.is_player_connected()
        if connected != _overlay_visible:
            _overlay_visible = connected
            if overlay_window is not None:
                try:
                    overlay_window.show() if connected else overlay_window.hide()
                except Exception:
                    pass

        try:
            map_name = plugin_client.get_map_name() if connected else None
        except PluginUnavailableError:
            map_name = None
        if map_name != _server_map_name:
            _server_map_name = map_name
            if main_window is not None:
                try:
                    main_window.evaluate_js(
                        f"window.onServerMapChanged && window.onServerMapChanged({json.dumps(map_name)})"
                    )
                except Exception:
                    pass

        _stop_overlay_polling.wait(OVERLAY_POLL_INTERVAL_SECONDS)


def get_screen_size() -> tuple[int, int]:
    user32 = ctypes.windll.user32
    return user32.GetSystemMetrics(0), user32.GetSystemMetrics(1)


_UI_WATCH_EXTENSIONS = {".html", ".js", ".css"}


def _ui_file_mtimes(root: Path) -> dict[Path, float]:
    mtimes: dict[Path, float] = {}
    for p in root.rglob("*"):
        if p.suffix not in _UI_WATCH_EXTENSIONS:
            continue
        try:
            mtimes[p] = p.stat().st_mtime
        except OSError:
            # Fichier supprimé/verrouillé (éditeur, antivirus...) entre le listing et le
            # stat() — ignoré pour ce tour plutôt que de laisser l'exception remonter :
            # non catchée ici, elle tuerait silencieusement ce thread daemon pour le
            # reste de la session (aucune erreur visible, juste plus aucun rechargement).
            continue
    return mtimes


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
        try:
            current_mtimes = _ui_file_mtimes(root)
            if current_mtimes != last_mtimes:
                last_mtimes = current_mtimes
                window.load_url(str(index_path))
        except Exception:
            # Idem : une erreur transitoire (fenêtre pas encore prête, etc.) ne doit
            # jamais arrêter la veille pour le reste de la session.
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
    api_base.set_main_window(main_window)

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
        y=margin,
    )

    keyboard.add_hotkey("f9", on_capture_hotkey)
    # F10 est par défaut lié à "quitter le jeu" (cs_quit_prompt) dans de nombreuses
    # configurations CS2 — F6 évite ce conflit.
    keyboard.add_hotkey("f6", on_test_hotkey)
    keyboard.add_hotkey("f7", on_fix_map_hotkey)

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
