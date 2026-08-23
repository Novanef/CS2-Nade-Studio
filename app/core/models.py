"""Modèle de données — voir docs/structure-donnees-lineups.md (source de vérité).

Le schéma inclut `category`/`spawnPoint` sur Lineup et l'entité SpawnPoint dès
maintenant (support des "instant smokes"), même si le flux de création
correspondant reste hors de ce MVP — évite une migration de données plus tard.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

Side = Literal["T", "CT"]
GrenadeType = Literal["smoke", "flash", "molotov", "he", "decoy"]
Movement = Literal["stand", "walk", "run", "jump", "wjump", "walkrunjump"]
ClickType = Literal["left", "right", "middle"]
ReferenceType = Literal["position", "aim", "both"]
WaypointType = Literal["checkpoint", "throw"]
LineupCategory = Literal["standard", "instant"]
LineupSource = Literal["manual", "plugin_capture", "mixed"]

SIDES: tuple[Side, ...] = ("T", "CT")
GRENADE_TYPES: tuple[GrenadeType, ...] = ("smoke", "flash", "molotov", "he", "decoy")
MOVEMENTS: tuple[Movement, ...] = ("stand", "walk", "run", "jump", "wjump", "walkrunjump")
CLICK_TYPES: tuple[ClickType, ...] = ("left", "right", "middle")
REFERENCE_TYPES: tuple[ReferenceType, ...] = ("position", "aim", "both")
WAYPOINT_TYPES: tuple[WaypointType, ...] = ("checkpoint", "throw")
LINEUP_CATEGORIES: tuple[LineupCategory, ...] = ("standard", "instant")
LINEUP_SOURCES: tuple[LineupSource, ...] = ("manual", "plugin_capture", "mixed")


@dataclass
class Position:
    x: float
    y: float
    z: float

    def to_dict(self) -> dict:
        return {"x": self.x, "y": self.y, "z": self.z}

    @staticmethod
    def from_dict(data: dict) -> "Position":
        return Position(x=data["x"], y=data["y"], z=data["z"])


@dataclass
class ViewAngle:
    yaw: float
    pitch: float

    def to_dict(self) -> dict:
        return {"yaw": self.yaw, "pitch": self.pitch}

    @staticmethod
    def from_dict(data: dict) -> "ViewAngle":
        return ViewAngle(yaw=data["yaw"], pitch=data["pitch"])


@dataclass
class Waypoint:
    order: int
    type: WaypointType
    referenceType: ReferenceType
    position: Position
    viewAngle: ViewAngle
    movement: Movement
    captured: bool
    crouch: bool
    clickType: ClickType | None = None
    screenshotRef: str | None = None
    # Recadrage zoomé autour du viseur (toujours au centre exact de l'écran), avec un
    # viseur dessiné par l'app — le HUD/viseur du jeu est masqué pendant la capture
    # (voir CLAUDE.md, HideHUD) donc le viseur réel n'apparaît jamais sur les captures.
    screenshotZoomRef: str | None = None
    description: str | None = None

    def to_dict(self) -> dict:
        return {
            "order": self.order,
            "type": self.type,
            "referenceType": self.referenceType,
            "position": self.position.to_dict(),
            "viewAngle": self.viewAngle.to_dict(),
            "movement": self.movement,
            "crouch": self.crouch,
            "clickType": self.clickType,
            "screenshotRef": self.screenshotRef,
            "screenshotZoomRef": self.screenshotZoomRef,
            "description": self.description,
            "captured": self.captured,
        }

    @staticmethod
    def from_dict(data: dict) -> "Waypoint":
        return Waypoint(
            order=data["order"],
            type=data["type"],
            referenceType=data["referenceType"],
            position=Position.from_dict(data["position"]),
            viewAngle=ViewAngle.from_dict(data["viewAngle"]),
            movement=data["movement"],
            crouch=data["crouch"],
            clickType=data.get("clickType"),
            screenshotRef=data.get("screenshotRef"),
            screenshotZoomRef=data.get("screenshotZoomRef"),
            description=data.get("description"),
            captured=data["captured"],
        )


@dataclass
class Lineup:
    id: str
    mapId: str
    side: Side
    grenadeType: GrenadeType
    spotName: str
    source: LineupSource
    createdAt: str
    updatedAt: str
    waypoints: list[Waypoint] = field(default_factory=list)
    category: LineupCategory = "standard"
    spawnPoint: str | None = None
    notes: str = ""
    favorite: bool = False

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "mapId": self.mapId,
            "side": self.side,
            "grenadeType": self.grenadeType,
            "category": self.category,
            "spawnPoint": self.spawnPoint,
            "spotName": self.spotName,
            "notes": self.notes,
            "favorite": self.favorite,
            "source": self.source,
            "createdAt": self.createdAt,
            "updatedAt": self.updatedAt,
            "waypoints": [wp.to_dict() for wp in self.waypoints],
        }

    @staticmethod
    def from_dict(data: dict) -> "Lineup":
        return Lineup(
            id=data["id"],
            mapId=data["mapId"],
            side=data["side"],
            grenadeType=data["grenadeType"],
            category=data.get("category", "standard"),
            spawnPoint=data.get("spawnPoint"),
            spotName=data["spotName"],
            notes=data.get("notes", ""),
            favorite=data.get("favorite", False),
            source=data["source"],
            createdAt=data["createdAt"],
            updatedAt=data["updatedAt"],
            waypoints=[Waypoint.from_dict(wp) for wp in data.get("waypoints", [])],
        )

    @property
    def throw_waypoint(self) -> Waypoint | None:
        return next((wp for wp in self.waypoints if wp.type == "throw"), None)

    @property
    def throw_label(self) -> str | None:
        wp = self.throw_waypoint
        if wp is None or wp.clickType is None:
            return None
        return derive_throw_label(wp.movement, wp.clickType)


@dataclass
class Map:
    id: str
    displayName: str
    radarImageRef: str
    # Calibration radar (voir CLAUDE.md) : transforme une position monde (x, y) en pixel
    # sur l'image radarImageRef (1024x1024) : px = (x - radarPosX) / radarScale,
    # py = (radarPosY - y) / radarScale (axe Y inversé entre monde et image).
    radarPosX: float | None = None
    radarPosY: float | None = None
    radarScale: float | None = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "displayName": self.displayName,
            "radarImageRef": self.radarImageRef,
            "radarPosX": self.radarPosX,
            "radarPosY": self.radarPosY,
            "radarScale": self.radarScale,
        }

    @staticmethod
    def from_dict(data: dict) -> "Map":
        return Map(
            id=data["id"],
            displayName=data["displayName"],
            radarImageRef=data["radarImageRef"],
            radarPosX=data.get("radarPosX"),
            radarPosY=data.get("radarPosY"),
            radarScale=data.get("radarScale"),
        )


@dataclass
class SpawnPoint:
    id: str
    mapId: str
    side: Side
    index: int
    position: Position

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "mapId": self.mapId,
            "side": self.side,
            "index": self.index,
            "position": self.position.to_dict(),
        }

    @staticmethod
    def from_dict(data: dict) -> "SpawnPoint":
        return SpawnPoint(
            id=data["id"],
            mapId=data["mapId"],
            side=data["side"],
            index=data["index"],
            position=Position.from_dict(data["position"]),
        )


_MOVEMENT_LABELS: dict[Movement, str] = {
    "stand": "",
    "walk": "",
    "run": "Run",
    "jump": "Jump",
    "wjump": "W+Jump",
    "walkrunjump": "Walk+Run+Jump",
}


def derive_throw_label(movement: Movement, clickType: ClickType) -> str:
    """Dérive un libellé affiché (ex. "Jumpthrow") depuis movement + clickType,
    plutôt que de le stocker séparément — voir structure-donnees-lineups.md."""
    prefix = _MOVEMENT_LABELS.get(movement, "")
    return f"{prefix}throw" if prefix else "Throw"
