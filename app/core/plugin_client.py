"""Client HTTP vers le plugin CounterStrikeSharp (voir docs/structure-plugin-cs2sharp.md).

Ne parle jamais qu'à localhost : le plugin n'existe que sur le serveur dédié local
administré par l'utilisateur (voir la contrainte de sécurité dans CLAUDE.md).
"""

from __future__ import annotations

import requests

DEFAULT_PORT = 5050
DEFAULT_TIMEOUT = 2.0


class PluginUnavailableError(Exception):
    pass


def get_position(port: int = DEFAULT_PORT, timeout: float = DEFAULT_TIMEOUT) -> dict | None:
    """Renvoie {'x','y','z','pitch','yaw'} ou None si aucun joueur n'est trouvé côté serveur."""
    try:
        response = requests.get(f"http://localhost:{port}/position", timeout=timeout)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise PluginUnavailableError(str(exc)) from exc

    data = response.json()
    if not data.get("Found"):
        return None

    return {
        "x": data["X"],
        "y": data["Y"],
        "z": data["Z"],
        "pitch": data["Pitch"],
        "yaw": data["Yaw"],
    }


def is_player_connected(port: int = DEFAULT_PORT, timeout: float = DEFAULT_TIMEOUT) -> bool:
    """True seulement si le plugin répond ET qu'un joueur est trouvé — regroupe
    "serveur non lancé" et "serveur lancé sans joueur" en un seul booléen, pour
    l'affichage conditionnel de l'overlay (voir main.py)."""
    try:
        return get_position(port=port, timeout=timeout) is not None
    except PluginUnavailableError:
        return False


def get_map_name(port: int = DEFAULT_PORT, timeout: float = DEFAULT_TIMEOUT) -> str | None:
    try:
        response = requests.get(f"http://localhost:{port}/status", timeout=timeout)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise PluginUnavailableError(str(exc)) from exc

    return response.json().get("mapName")


def run_command(cmd: str, port: int = DEFAULT_PORT, timeout: float = DEFAULT_TIMEOUT) -> None:
    """Exécute une commande console arbitraire côté serveur (voir /debug/cmd,
    HttpApiServer.cs) — utilisé pour bot_kick avant une téléportation vers un
    spawn, un bot présent sur le spawn ferait atterrir le joueur sur lui."""
    try:
        response = requests.post(f"http://localhost:{port}/debug/cmd", params={"cmd": cmd}, data=b"", timeout=timeout)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise PluginUnavailableError(str(exc)) from exc


def change_map(map_id: str, port: int = DEFAULT_PORT, timeout: float = DEFAULT_TIMEOUT) -> None:
    """Recharge le serveur sur une autre carte (voir run_command) — utilisé par le
    bouton "Changer de map" du picker de spawn quand la map serveur ne correspond
    pas à celle du lineup visé."""
    run_command(f"changelevel de_{map_id}", port=port, timeout=timeout)


def get_player_positions(port: int = DEFAULT_PORT, timeout: float = DEFAULT_TIMEOUT) -> list[dict]:
    """Positions de tous les joueurs valides, bots inclus (contrairement à
    get_position, qui ne prend que le premier humain) — voir HttpApiServer.cs,
    utilisé pour éviter de téléporter un joueur sur un bot qui occupe un spawn."""
    try:
        response = requests.get(f"http://localhost:{port}/debug/player_positions", timeout=timeout)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise PluginUnavailableError(str(exc)) from exc

    return response.json().get("positions", [])


def teleport(
    x: float,
    y: float,
    z: float,
    pitch: float,
    yaw: float,
    port: int = DEFAULT_PORT,
    timeout: float = DEFAULT_TIMEOUT,
) -> bool:
    payload = {"X": x, "Y": y, "Z": z, "Pitch": pitch, "Yaw": yaw}
    try:
        response = requests.post(f"http://localhost:{port}/teleport", json=payload, timeout=timeout)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise PluginUnavailableError(str(exc)) from exc

    return bool(response.json().get("success"))


def prepare_capture(port: int = DEFAULT_PORT, timeout: float = DEFAULT_TIMEOUT) -> dict | None:
    """Masque le HUD + trajectoire/caméra de grenade (voir HttpApiServer.cs) avant un
    screenshot. Renvoie l'état d'origine (dict opaque) à repasser tel quel à
    restore_capture(), ou None si aucun joueur trouvé (dans ce cas, ne pas appeler
    restore_capture)."""
    try:
        response = requests.post(f"http://localhost:{port}/capture/prepare", data=b"", timeout=timeout)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise PluginUnavailableError(str(exc)) from exc

    return response.json().get("original")


def restore_capture(original: dict, port: int = DEFAULT_PORT, timeout: float = DEFAULT_TIMEOUT) -> bool:
    payload = {"Original": original}
    try:
        response = requests.post(f"http://localhost:{port}/capture/restore", json=payload, timeout=timeout)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise PluginUnavailableError(str(exc)) from exc

    return bool(response.json().get("success"))
