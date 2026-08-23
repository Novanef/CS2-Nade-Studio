"""Garantit que le build consultation-only n'importe jamais keyboard/mss/psutil,
même transitivement — condition nécessaire pour qu'il tourne sans ces
dépendances installées et sans serveur/plugin CS2 (voir main_consultation.py).

Doit s'exécuter dans un sous-processus : d'autres modules de test déjà importés
dans la session pytest courante (ex. main.py, core.capture) ont probablement déjà
chargé ces paquets dans sys.modules, ce qui rendrait l'assertion inutile si on
l'exécutait dans l'interpréteur du test runner lui-même."""

import subprocess
import sys
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent.parent

_FORBIDDEN_MODULES = ("keyboard", "mss", "psutil")


def test_main_consultation_does_not_import_capture_only_deps():
    check = (
        "import sys, main_consultation; "
        f"forbidden = [m for m in {_FORBIDDEN_MODULES!r} if m in sys.modules]; "
        "sys.exit(1) if forbidden else sys.exit(0)"
    )
    result = subprocess.run(
        [sys.executable, "-c", check],
        cwd=str(APP_DIR),
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"main_consultation a importé une dépendance capture-only "
        f"(stdout={result.stdout!r}, stderr={result.stderr!r})"
    )
