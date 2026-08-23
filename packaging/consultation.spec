# -*- mode: python ; coding: utf-8 -*-
"""Build PyInstaller du .exe consultation-only (browse + radar, sans capture/
plugin CS2) — voir app/main_consultation.py.

Usage (depuis un venv construit avec app/requirements-consultation.txt UNIQUEMENT,
pour garantir qu'aucune dépendance capture-only ne se glisse dans le bundle) :

    pyinstaller packaging/consultation.spec

Sortie : dist/CS2NadeStudioViewer/ (--onedir, pas --onefile — voir le plan de
distribution : démarrage plus rapide, plus simple à déboguer, pas de
complication sys._MEIPASS liée à l'auto-extraction à chaque lancement).
"""

import os

REPO_ROOT = os.path.abspath(os.path.join(SPECPATH, ".."))
APP_DIR = os.path.join(REPO_ROOT, "app")

block_cipher = None

a = Analysis(
    [os.path.join(APP_DIR, "main_consultation.py")],
    pathex=[APP_DIR],
    binaries=[],
    datas=[
        (os.path.join(APP_DIR, "data", "maps.json"), "data"),
        # spawnpoints.json (positions statiques par carte, voir core/storage.py)
        # est nécessaire à l'affichage des groupes "instant smoke" importés —
        # PAS lineups.json, volontairement absent : le build consultation-only
        # démarre vide et se peuple uniquement par import (voir main_consultation.py).
        (os.path.join(APP_DIR, "data", "seed", "spawnpoints.json"), os.path.join("data", "seed")),
        (os.path.join(APP_DIR, "assets", "radar"), os.path.join("assets", "radar")),
        (os.path.join(APP_DIR, "ui", "main_window", "index.html"), os.path.join("ui", "main_window")),
        (os.path.join(APP_DIR, "ui", "main_window", "main.js"), os.path.join("ui", "main_window")),
        (os.path.join(APP_DIR, "ui", "main_window", "logic.js"), os.path.join("ui", "main_window")),
        (os.path.join(APP_DIR, "ui", "main_window", "style.css"), os.path.join("ui", "main_window")),
        (
            os.path.join(APP_DIR, "ui", "main_window", "vendor"),
            os.path.join("ui", "main_window", "vendor"),
        ),
    ],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    # Ne jamais bundler ces dépendances capture-only, même si un import
    # accidentel les ferait détecter — signal d'alerte immédiat au build plutôt
    # qu'un exe silencieusement plus lourd. Voir app/core/api_base.py et
    # app/tests/test_main_consultation_imports.py.
    excludes=["keyboard", "mss", "psutil", "requests"],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="CS2NadeStudioViewer",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    icon=os.path.join(APP_DIR, "assets", "app_icon.ico"),
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="CS2NadeStudioViewer",
)
