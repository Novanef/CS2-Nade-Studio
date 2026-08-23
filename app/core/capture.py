"""Session de capture d'un lineup simple (un seul waypoint "throw") via le plugin.

Déclenchement prévu au clavier (F9/F10) pendant que le focus reste sur CS2 — voir
CLAUDE.md. Cette classe ne branche pas elle-même les hotkeys, elle expose juste
les actions que main.py relie à `keyboard.add_hotkey`.
"""

from __future__ import annotations

import ctypes
import time
import uuid
from ctypes import wintypes
from dataclasses import dataclass
from datetime import datetime, timezone

import mss
import mss.tools
import psutil
from PIL import Image, ImageDraw

from core import plugin_client
from core.image_derivatives import (
    DETAIL_JPEG_QUALITY as _DETAIL_JPEG_QUALITY,
    DETAIL_MAX_WIDTH as _DETAIL_MAX_WIDTH,
    THUMB_JPEG_QUALITY as _THUMB_JPEG_QUALITY,
    THUMB_WIDTH as _THUMB_WIDTH,
    save_resized_jpeg as _save_resized_jpeg,
)
from core.models import ClickType, GrenadeType, Lineup, LineupCategory, Movement, Position, Side, ViewAngle, Waypoint
from core.storage import SCREENSHOTS_DIR

CS2_WINDOW_TITLE = "Counter-Strike 2"

# Court délai de sécurité après /capture/prepare avant le screenshot — l'effet est
# quasi instantané depuis le fix Utilities.SetStateChanged (voir HttpApiServer.cs
# et CLAUDE.md), mais laisse une marge pour le round-trip réseau.
_HUD_HIDE_DELAY_SECONDS = 0.1

# Viseur dessiné par l'app (le vrai viseur du jeu est masqué avec le reste du HUD
# pendant la capture, voir HideHUD dans HttpApiServer.cs) — toujours au centre exact
# de la fenêtre, donc pas besoin de le localiser dynamiquement.
_CROSSHAIR_COLOR = (255, 0, 255)
_CROSSHAIR_ARM_LENGTH = 14
_CROSSHAIR_GAP = 4
_CROSSHAIR_THICKNESS = 3

_ZOOM_CROP_HALF_SIZE = 55
_ZOOM_SCALE = 4

# Dérivés JPEG allégés du screenshot plein format (~8 Mo en 4160x1440), générés à la
# capture pour éviter d'envoyer l'original entier à travers le pont IPC pywebview à
# chaque sélection de lineup dans l'UI (voir get_screenshot_thumb_data_url /
# get_screenshot_detail_data_url dans main.py). Le crop zoom (_zoom.png) n'est pas
# concerné, déjà assez petit pour vérifier l'alignement précis du viseur.


def _is_dedicated_server_process(pid: int) -> bool:
    """Le serveur dédié local (voir docs/installation-locale.md) crée aussi une fenêtre
    titrée "Counter-Strike 2" — on l'exclut via son flag de lancement -dedicated pour ne
    jamais capturer sa fenêtre à la place de celle du client."""
    try:
        return "-dedicated" in psutil.Process(pid).cmdline()
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        return False


def _find_cs2_window() -> int | None:
    user32 = ctypes.windll.user32
    found: list[int] = []

    def callback(hwnd: int, _lparam: int) -> bool:
        length = user32.GetWindowTextLengthW(hwnd)
        if length == 0 or not user32.IsWindowVisible(hwnd):
            return True
        buf = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buf, length + 1)
        if buf.value != CS2_WINDOW_TITLE:
            return True

        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        if _is_dedicated_server_process(pid.value):
            return True

        found.append(hwnd)
        return False

    enum_proc = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)(callback)
    user32.EnumWindows(enum_proc, 0)
    return found[0] if found else None


def _get_cs2_client_region() -> dict | None:
    """Zone d'affichage (client area, sans bordure/barre de titre) de la fenêtre CS2,
    en coordonnées écran — pour ne capturer que le jeu, jamais le reste de l'affichage
    (autre écran, autre fenêtre en mode fenêtré)."""
    user32 = ctypes.windll.user32
    hwnd = _find_cs2_window()
    if hwnd is None:
        return None

    rect = wintypes.RECT()
    user32.GetClientRect(hwnd, ctypes.byref(rect))
    top_left = wintypes.POINT(rect.left, rect.top)
    user32.ClientToScreen(hwnd, ctypes.byref(top_left))

    width = rect.right - rect.left
    height = rect.bottom - rect.top
    if width <= 0 or height <= 0:
        return None

    return {"left": top_left.x, "top": top_left.y, "width": width, "height": height}


class _BITMAPINFOHEADER(ctypes.Structure):
    _fields_ = [
        ("biSize", wintypes.DWORD),
        ("biWidth", wintypes.LONG),
        ("biHeight", wintypes.LONG),
        ("biPlanes", wintypes.WORD),
        ("biBitCount", wintypes.WORD),
        ("biCompression", wintypes.DWORD),
        ("biSizeImage", wintypes.DWORD),
        ("biXPelsPerMeter", wintypes.LONG),
        ("biYPelsPerMeter", wintypes.LONG),
        ("biClrUsed", wintypes.DWORD),
        ("biClrImportant", wintypes.DWORD),
    ]


_PW_RENDERFULLCONTENT = 2


def _capture_window_rgb(hwnd: int, width: int, height: int) -> bytes | None:
    """Capture le contenu de la fenêtre `hwnd` via `PrintWindow` (rendu direct par
    DWM), plutôt qu'un grab d'écran par région (mss.grab). CS2 tourne en plein écran
    *sans bordure* (pas en exclusif) — n'importe quelle autre fenêtre (overlay,
    console du serveur dédié, barre des tâches) peut physiquement se superposer aux
    mêmes pixels d'écran, et un grab par région les capturerait aussi. `PrintWindow`
    isole le contenu de cette fenêtre précise, indépendamment de ce qui est
    visuellement au-dessus (bug découvert en conditions réelles, voir CLAUDE.md)."""
    user32 = ctypes.windll.user32
    gdi32 = ctypes.windll.gdi32

    hwnd_dc = user32.GetWindowDC(hwnd)
    if not hwnd_dc:
        return None
    mem_dc = gdi32.CreateCompatibleDC(hwnd_dc)
    bitmap = gdi32.CreateCompatibleBitmap(hwnd_dc, width, height)
    gdi32.SelectObject(mem_dc, bitmap)

    try:
        if not user32.PrintWindow(hwnd, mem_dc, _PW_RENDERFULLCONTENT):
            return None

        bmi = _BITMAPINFOHEADER()
        bmi.biSize = ctypes.sizeof(_BITMAPINFOHEADER)
        bmi.biWidth = width
        bmi.biHeight = -height  # top-down
        bmi.biPlanes = 1
        bmi.biBitCount = 32
        bmi.biCompression = 0  # BI_RGB

        buffer = (ctypes.c_ubyte * (width * height * 4))()
        scanlines = gdi32.GetDIBits(mem_dc, bitmap, 0, height, buffer, ctypes.byref(bmi), 0)
        if scanlines == 0:
            return None

        bgra = bytes(buffer)
        rgb = bytearray(width * height * 3)
        rgb[0::3] = bgra[2::4]
        rgb[1::3] = bgra[1::4]
        rgb[2::3] = bgra[0::4]
        return bytes(rgb)
    finally:
        gdi32.DeleteObject(bitmap)
        gdi32.DeleteDC(mem_dc)
        user32.ReleaseDC(hwnd, hwnd_dc)


def _draw_crosshair(draw: ImageDraw.ImageDraw, cx: int, cy: int, scale: int = 1) -> None:
    gap = _CROSSHAIR_GAP * scale
    length = _CROSSHAIR_ARM_LENGTH * scale
    thickness = _CROSSHAIR_THICKNESS * scale
    half_t = thickness // 2 or 1

    # Barre horizontale (deux segments, gauche/droite, avec un espace au centre)
    draw.rectangle([cx - gap - length, cy - half_t, cx - gap, cy + half_t], fill=_CROSSHAIR_COLOR)
    draw.rectangle([cx + gap, cy - half_t, cx + gap + length, cy + half_t], fill=_CROSSHAIR_COLOR)
    # Barre verticale (haut/bas)
    draw.rectangle([cx - half_t, cy - gap - length, cx + half_t, cy - gap], fill=_CROSSHAIR_COLOR)
    draw.rectangle([cx - half_t, cy + gap, cx + half_t, cy + gap + length], fill=_CROSSHAIR_COLOR)


@dataclass
class CaptureDraft:
    mapId: str
    side: Side
    grenadeType: GrenadeType
    spotName: str
    notes: str = ""
    category: LineupCategory = "standard"
    movement: Movement = "stand"
    clickType: ClickType = "left"
    crouch: bool = False
    spawnPoint: str | None = None
    waypoint: Waypoint | None = None
    editingLineupId: str | None = None


class CaptureSession:
    """Une session à la fois — cohérent avec l'hypothèse d'un seul joueur humain."""

    def __init__(self) -> None:
        self.draft: CaptureDraft | None = None

    def start(
        self,
        mapId: str,
        side: Side,
        grenadeType: GrenadeType,
        spotName: str,
        notes: str = "",
        category: LineupCategory = "standard",
        movement: Movement = "stand",
        clickType: ClickType = "left",
        crouch: bool = False,
        spawnPoint: str | None = None,
        editingLineupId: str | None = None,
    ) -> CaptureDraft:
        """Le formulaire de création appelle cette méthode à l'ouverture ET à
        chaque champ modifié (voir armCapture côté JS, pas de bouton "Démarrer"
        séparé) — il faut donc, comme update_fields en édition, conserver le
        waypoint déjà capturé plutôt que le jeter à chaque frappe, sauf si la
        carte/le camp/le spawn change (la position capturée n'a alors plus de
        sens). Sans ça, taper le nom du spot après un F9 invalidait la capture
        et grisait indéfiniment le bouton sauvegarder tant qu'on ne recapturait
        pas en dernier."""
        previous = self.draft
        waypoint = None
        if (
            previous is not None
            and previous.editingLineupId is None
            and previous.mapId == mapId
            and previous.side == side
            and previous.spawnPoint == spawnPoint
        ):
            waypoint = previous.waypoint
            if waypoint is not None:
                waypoint.movement = movement
                waypoint.clickType = clickType
                waypoint.crouch = crouch

        self.draft = CaptureDraft(
            mapId=mapId,
            side=side,
            grenadeType=grenadeType,
            spotName=spotName,
            notes=notes,
            category=category,
            movement=movement,
            clickType=clickType,
            crouch=crouch,
            spawnPoint=spawnPoint,
            editingLineupId=editingLineupId,
            waypoint=waypoint,
        )
        return self.draft

    def start_edit(self, lineup: Lineup) -> CaptureDraft:
        """Réutilise le formulaire de création en mode édition : pré-remplit le
        draft avec les données du lineup existant, waypoint compris, pour que la
        position/le screenshot capturés restent valides si l'utilisateur ne
        recapture pas via F9 (voir CLAUDE.md et le plan de la fonctionnalité)."""
        wp = lineup.throw_waypoint
        self.draft = CaptureDraft(
            mapId=lineup.mapId,
            side=lineup.side,
            grenadeType=lineup.grenadeType,
            spotName=lineup.spotName,
            notes=lineup.notes,
            category=lineup.category,
            movement=wp.movement if wp else "stand",
            clickType=wp.clickType if wp and wp.clickType else "left",
            crouch=wp.crouch if wp else False,
            spawnPoint=lineup.spawnPoint,
            waypoint=wp,
            editingLineupId=lineup.id,
        )
        return self.draft

    def update_fields(
        self,
        mapId: str,
        side: Side,
        grenadeType: GrenadeType,
        spotName: str,
        notes: str,
        movement: Movement,
        clickType: ClickType,
        crouch: bool,
        category: LineupCategory,
        spawnPoint: str | None,
    ) -> CaptureDraft:
        """Met à jour les champs du draft en cours d'édition sans perdre le
        waypoint existant, sauf si la carte, le camp ou le spawn (instant smoke)
        change — dans ces trois cas la position capturée ne correspond plus à
        l'emplacement sélectionné."""
        if self.draft is None:
            raise ValueError("no draft in progress")

        if (
            self.draft.mapId != mapId
            or self.draft.side != side
            or self.draft.spawnPoint != spawnPoint
        ):
            self.draft.waypoint = None

        self.draft.mapId = mapId
        self.draft.side = side
        self.draft.grenadeType = grenadeType
        self.draft.spotName = spotName
        self.draft.notes = notes
        self.draft.movement = movement
        self.draft.clickType = clickType
        self.draft.crouch = crouch
        self.draft.category = category
        self.draft.spawnPoint = spawnPoint

        if self.draft.waypoint is not None:
            self.draft.waypoint.movement = movement
            self.draft.waypoint.clickType = clickType
            self.draft.waypoint.crouch = crouch

        return self.draft

    def cancel(self) -> None:
        self.draft = None

    def capture_now(self) -> dict:
        """Appelée depuis le handler du hotkey F9. Renvoie un statut pour l'UI."""
        if self.draft is None:
            return {"status": "no_draft"}

        position = plugin_client.get_position()  # peut lever PluginUnavailableError
        if position is None:
            return {"status": "no_player"}

        screenshot_ref, screenshot_zoom_ref = self._take_screenshot()

        self.draft.waypoint = Waypoint(
            order=1,
            type="throw",
            referenceType="both",
            position=Position(x=position["x"], y=position["y"], z=position["z"]),
            viewAngle=ViewAngle(yaw=position["yaw"], pitch=position["pitch"]),
            movement=self.draft.movement,
            clickType=self.draft.clickType,
            crouch=self.draft.crouch,
            screenshotRef=screenshot_ref,
            screenshotZoomRef=screenshot_zoom_ref,
            captured=True,
        )
        return {"status": "captured", "waypoint": self.draft.waypoint.to_dict()}

    def test_now(self) -> dict:
        """Appelée depuis le handler du hotkey F10 : téléporte vers le waypoint capturé."""
        if self.draft is None or self.draft.waypoint is None:
            return {"status": "no_waypoint"}

        wp = self.draft.waypoint
        plugin_client.teleport(
            x=wp.position.x,
            y=wp.position.y,
            z=wp.position.z,
            pitch=wp.viewAngle.pitch,
            yaw=wp.viewAngle.yaw,
        )
        return {"status": "teleported"}

    def _take_screenshot(self) -> tuple[str | None, str | None]:
        """Capture uniquement le contenu de la fenêtre CS2, jamais l'écran entier ni
        une autre fenêtre superposée à la même zone (overlay, console du serveur
        dédié, barre des tâches — CS2 tourne en plein écran sans bordure, pas en
        exclusif). Renvoie (None, None) si la fenêtre CS2 n'est pas trouvée ou si la
        capture échoue, sans faire échouer la capture de position/visée, qui reste
        indépendante (voir architecture)."""
        hwnd = _find_cs2_window()
        if hwnd is None:
            return None, None
        region = _get_cs2_client_region()
        if region is None:
            return None, None

        original_hud = None
        try:
            original_hud = plugin_client.prepare_capture()
        except plugin_client.PluginUnavailableError:
            original_hud = None  # tant pis pour le HUD, le screenshot reste indépendant

        if original_hud is not None:
            time.sleep(_HUD_HIDE_DELAY_SECONDS)

        try:
            rgb = _capture_window_rgb(hwnd, region["width"], region["height"])
        finally:
            if original_hud is not None:
                try:
                    plugin_client.restore_capture(original_hud)
                except plugin_client.PluginUnavailableError:
                    pass  # au pire le joueur doit rouvrir le jeu pour retrouver son HUD

        if rgb is None:
            return None, None

        width, height = region["width"], region["height"]
        image = Image.frombytes("RGB", (width, height), rgb)
        cx, cy = width // 2, height // 2
        _draw_crosshair(ImageDraw.Draw(image), cx, cy)

        SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
        stem = uuid.uuid4()
        filename = f"{stem}.png"
        image.save(SCREENSHOTS_DIR / filename)
        _save_resized_jpeg(image, SCREENSHOTS_DIR / f"{stem}_thumb.jpg", _THUMB_WIDTH, _THUMB_JPEG_QUALITY)
        _save_resized_jpeg(image, SCREENSHOTS_DIR / f"{stem}_detail.jpg", _DETAIL_MAX_WIDTH, _DETAIL_JPEG_QUALITY)

        crop_box = (
            max(0, cx - _ZOOM_CROP_HALF_SIZE),
            max(0, cy - _ZOOM_CROP_HALF_SIZE),
            min(width, cx + _ZOOM_CROP_HALF_SIZE),
            min(height, cy + _ZOOM_CROP_HALF_SIZE),
        )
        zoomed = image.crop(crop_box)
        zoomed = zoomed.resize((zoomed.width * _ZOOM_SCALE, zoomed.height * _ZOOM_SCALE), Image.LANCZOS)
        zoom_filename = f"{stem}_zoom.png"
        zoomed.save(SCREENSHOTS_DIR / zoom_filename)

        return f"screenshots/{filename}", f"screenshots/{zoom_filename}"


def new_lineup_dict(draft: CaptureDraft, source: str) -> dict:
    """Construit le dict JSON-sérialisable d'un Lineup à partir d'un draft rempli."""
    if draft.waypoint is None:
        raise ValueError("draft has no waypoint yet")

    now = datetime.now(timezone.utc).isoformat()
    return {
        "id": str(uuid.uuid4()),
        "mapId": draft.mapId,
        "side": draft.side,
        "grenadeType": draft.grenadeType,
        "category": draft.category,
        "spawnPoint": draft.spawnPoint,
        "spotName": draft.spotName,
        "notes": draft.notes,
        "favorite": False,
        "source": source,
        "createdAt": now,
        "updatedAt": now,
        "waypoints": [draft.waypoint.to_dict()],
    }


def updated_lineup_fields(draft: CaptureDraft) -> dict:
    """Construit les kwargs pour storage.update_lineup(...) à partir d'un draft
    en mode édition (voir CaptureSession.start_edit/editingLineupId)."""
    if draft.waypoint is None:
        raise ValueError("draft has no waypoint yet")

    return {
        "mapId": draft.mapId,
        "side": draft.side,
        "grenadeType": draft.grenadeType,
        "category": draft.category,
        "spawnPoint": draft.spawnPoint,
        "spotName": draft.spotName,
        "notes": draft.notes,
        "waypoints": [draft.waypoint],
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
