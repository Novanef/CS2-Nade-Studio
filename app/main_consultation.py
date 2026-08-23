"""Point d'entrée du build consultation-only — browse + radar uniquement, sans
capture/hotkeys/plugin CS2. Voir app/main.py pour l'app complète.

N'importe jamais keyboard/mss/psutil/core.capture/core.plugin_client, même
transitivement (garanti par core.api_base — voir
app/tests/test_main_consultation_imports.py) : ce build doit rester utilisable
sans serveur/plugin CS2 et sans ces dépendances installées."""

from __future__ import annotations

import os
from pathlib import Path

import webview

from core import api_base, storage
from core.api_base import BrowseApi

APP_DIR = Path(__file__).resolve().parent


def _default_user_dir() -> Path:
    """%APPDATA%\\CS2NadeStudioViewer\\ — le dossier d'installation d'un exe
    empaqueté (PyInstaller) est souvent en lecture seule, contrairement au dossier
    app/data/user/ utilisé par l'app complète en développement."""
    appdata = os.environ.get("APPDATA")
    root = Path(appdata) if appdata else Path.home() / "AppData" / "Roaming"
    return root / "CS2NadeStudioViewer"


def main() -> None:
    storage.configure_user_dir(_default_user_dir())

    api = BrowseApi()
    index_path = APP_DIR / "ui" / "main_window" / "index.html"
    window = webview.create_window(
        "CS2 Nade Studio — Bibliothèque",
        str(index_path),
        js_api=api,
        width=1000,
        height=720,
    )
    api_base.set_main_window(window)

    webview.start(debug=False)


if __name__ == "__main__":
    main()
