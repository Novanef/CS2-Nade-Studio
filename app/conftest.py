import sys
from pathlib import Path

# main.py importe "core.*" en supposant que app/ est sur sys.path (cas normal :
# lancé via `python main.py` depuis ce dossier) — pytest peut être invoqué depuis
# la racine du repo, donc on l'ajoute explicitement ici plutôt que de dépendre du cwd.
sys.path.insert(0, str(Path(__file__).parent))
