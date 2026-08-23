# Installation locale — serveur CS2, Metamod, CounterStrikeSharp

Complète les autres documents du projet. Quatre étapes : le serveur dédié, Metamod:Source (la couche qui rend les plugins possibles), CounterStrikeSharp (le framework C#), puis votre plugin.

## Installation automatisée (recommandé)

`scripts/setup-server.ps1` encode les quatre étapes ci-dessous (et tous les pièges déjà rencontrés — chemin SteamCMD absolu, hook Metamod dans `gameinfo.gi`, `.vdf` CounterStrikeSharp mal placé, `sv_cheats`/practice) dans un script PowerShell idempotent :

```powershell
.\scripts\setup-server.ps1 -InstallDir D:\Documents\Github\cs2server `
    -SteamCmdExe C:\steamcmd\steamcmd.exe `
    -MetamodZip C:\downloads\mmsource-2.x-windows.zip `
    -CounterStrikeSharpZip C:\downloads\counterstrikesharp-with-runtime-windows.zip `
    -PluginBuildDir D:\Documents\Github\CS2-Nade-Studio\plugin\LineupCapturePlugin\bin\Release\net10.0
```

Il ne télécharge pas Metamod/CounterStrikeSharp lui-même (leurs URLs de release changent de version en version) — préparer les archives `.zip` en amont. Peut être relancé sans risque après une mise à jour CS2 qui casse `gameinfo.gi` — c'est d'ailleurs l'usage prévu en cas de blocage post-update. Les étapes manuelles ci-dessous restent le fallback/debug si le script échoue sur un cas non prévu.

## 1. Serveur dédié CS2 (via SteamCMD)

Contrairement à CS:GO, CS2 n'a pas d'App ID séparé pour le serveur dédié — c'est le même App ID que le client : **730**.

```powershell
steamcmd.exe +force_install_dir D:\Documents\Github\cs2server +login anonymous +app_update 730 validate +quit
```

**Toujours un chemin absolu.** Un chemin relatif avec `..` (ex. `../cs2server`) n'est pas fiablement résolu par SteamCMD — il est régulièrement ignoré silencieusement, et les fichiers atterrissent dans `steamcmd\steamapps\common\Counter-Strike Global Offensive\game` au lieu du dossier voulu. C'est un bug connu et documenté de SteamCMD (pas spécifique à ce projet), pas un problème d'ordre des commandes — `force_install_dir` avant `login` (déjà le cas ci-dessus) reste correct.

Une fois terminé, `cs2.exe` se trouve dans `cs2server\game\bin\win64\cs2.exe`.

Pour lancer un premier test :

```powershell
cs2.exe -dedicated +map de_mirage +sv_lan 1
```

`sv_lan 1` évite d'avoir besoin d'un Game Server Login Token (GSLT) — utile ici puisque le serveur n'a pas vocation à accepter des connexions extérieures, seulement la vôtre en local.

## 2. Metamod:Source

Metamod est la couche de base qui permet à CS2 de charger des plugins tiers — CounterStrikeSharp est construit dessus.

1. Télécharger le build Windows de Metamod:Source (branche 2.x dev) depuis son site officiel.
2. Extraire le dossier `addons` obtenu directement dans `cs2server\game\csgo\`.
3. Ouvrir `cs2server\game\csgo\gameinfo.gi` dans un éditeur de texte.
4. Repérer la ligne :

   ```text
   Game_LowViolence csgo_lv // Perfect World content override
   ```

5. Ajouter juste en dessous :

   ```text
   Game csgo/addons/metamod
   ```

6. Sauvegarder, relancer le serveur, puis taper dans sa console :

   ```text
   meta version
   ```

   Si Metamod est bien chargé, la commande répond avec les informations de version plutôt qu'une erreur de commande inconnue. La ligne `[META] Loaded N plugins.` au tout début du log indique combien de plugins Metamod a lui-même découverts au démarrage — voir l'étape suivante pour ce qui compte comme un plugin ici.

**Piège connu** : chaque mise à jour de CS2 réécrit `gameinfo.gi` et efface cette ligne. Il faut la rajouter après chaque mise à jour du jeu, avant que les plugins ne fonctionnent à nouveau.

## 3. CounterStrikeSharp

1. Télécharger la version **« with runtime »** pour Windows depuis les releases GitHub de CounterStrikeSharp (la version « with runtime » inclut le runtime .NET, pas besoin de l'installer séparément).
2. Extraire l'archive dans `cs2server\game\csgo\addons\` — elle fusionne avec le dossier `metamod` déjà présent plutôt que de le remplacer.
3. **Point critique, source d'un incident vécu sur ce projet** : l'archive dépose un fichier `counterstrikesharp.vdf` directement dans `cs2server\game\csgo\addons\`. C'est le **mauvais emplacement** — Metamod ne scanne que son propre dossier (`addons\metamod\`, ou la valeur de `mm_basedir`) pour découvrir les plugins à charger automatiquement via leurs `.vdf`. Un `.vdf` de plugin laissé à la racine de `addons\` est silencieusement ignoré : pas d'erreur, juste `[META] Loaded 0 plugins.` au démarrage, et CounterStrikeSharp ne charge jamais — symptôme facilement confondu avec une incompatibilité moteur. **Déplacer `counterstrikesharp.vdf` dans `cs2server\game\csgo\addons\metamod\`** avant de relancer le serveur.
4. Relancer le serveur, puis vérifier dans la console :

   ```text
   css_plugins list
   ```

   CounterStrikeSharp doit apparaître dans la liste. Vérifier aussi tôt dans le log que `[META] Loaded 1 plugin.` (ou plus, selon les autres plugins Metamod installés) apparaît — pas `0 plugins`.

## 4. Déployer votre plugin

Une fois `LineupCapturePlugin` compilé (voir `structure-plugin-cs2sharp.md`) :

1. Copier le dossier de sortie de compilation (contenant le `.dll`) dans :

   ```text
   cs2server\game\csgo\addons\counterstrikesharp\plugins\LineupCapturePlugin\
   ```

2. Relancer le serveur.
3. Vérifier avec `css_plugins list` que `Lineup Capture API` apparaît, chargé sans erreur.
4. Tester le point d'accès depuis un navigateur ou `curl` pendant que vous êtes connecté en jeu :

   ```powershell
   curl http://localhost:5050/position
   ```

   Une réponse JSON avec vos coordonnées confirme que toute la chaîne fonctionne, du serveur jusqu'à l'application.

## Points d'attention

- **`gameinfo.gi` à refaire après chaque mise à jour CS2** — le point de friction le plus fréquent signalé par la communauté.
- **GSLT non nécessaire** pour un usage strictement local avec `sv_lan 1` — à réserver au jour où vous voudriez ouvrir le serveur à d'autres joueurs.
- **Port 5050 libre** — si un conflit survient avec un autre logiciel sur la machine, changer le port dans le plugin (voir `structure-plugin-cs2sharp.md`) et dans la configuration de l'application.
- **Redémarrage requis** après chaque changement (Metamod, CounterStrikeSharp, plugin) — CS2 ne recharge pas ces couches à chaud de façon fiable.
