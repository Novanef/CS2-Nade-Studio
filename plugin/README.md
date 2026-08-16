# LineupCapturePlugin

Plugin CounterStrikeSharp exposant l'API HTTP locale utilisée par l'application (`app/`) pour lire la position du joueur et le téléporter, pendant la création de lineups sur un serveur CS2 dédié local.

Voir `docs/structure-plugin-cs2sharp.md` pour le détail de l'architecture interne, et `docs/installation-locale.md` pour l'installation complète du serveur dédié, Metamod:Source et CounterStrikeSharp.

## Build

```
dotnet build LineupCapturePlugin/LineupCapturePlugin.csproj -c Release
```

## Déployer

Copier le dossier de sortie (`bin/Release/net10.0/`, contenant `LineupCapturePlugin.dll` et `LineupCapturePlugin.deps.json`) dans :

```
cs2server\game\csgo\addons\counterstrikesharp\plugins\LineupCapturePlugin\
```

Relancer le serveur, puis vérifier :

```
css_plugins list
```

`Lineup Capture API` doit apparaître, chargé sans erreur.

## Valider l'API

En jeu, sur le serveur local :

```
curl http://localhost:5050/position
```

```
curl -X POST http://localhost:5050/teleport -H "Content-Type: application/json" -d "{\"X\":0,\"Y\":0,\"Z\":100,\"Pitch\":0,\"Yaw\":0}"
```

Le premier doit renvoyer les coordonnées actuelles du joueur, le second doit le téléporter visiblement en jeu.

**Sans joueur connecté** (ex. pour valider juste l'API), lancer le serveur avec `+sv_hibernate_when_empty 0` — sinon le serveur hiberne et les requêtes peuvent expirer (voir CLAUDE.md, section "points résolus").

## Points non vérifiés

Voir la section correspondante dans `CLAUDE.md` (racine du repo).
