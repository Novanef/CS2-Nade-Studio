# Structure de données — Lineups CS2

## Vue d'ensemble

Trois entités :

- **Map** — référentiel des cartes (statique, peu susceptible de changer souvent)
- **Lineup** — un lancer de grenade avec son contexte (carte, camp, spot, type de grenade)
- **Waypoint** — un point du trajet vers ce lancer ; un lineup a un ou plusieurs waypoints ordonnés, le dernier étant toujours le point de lancer

Ce découpage permet de représenter aussi bien un lineup simple (un seul waypoint) qu'un lineup avec déplacement intermédiaire (plusieurs waypoints), sans changer de structure ni de code d'affichage.

## Entités

### Map

| Champ | Type | Description |
|---|---|---|
| `id` | string | Identifiant court (slug), ex. `"mirage"` |
| `displayName` | string | Nom affiché, ex. `"Mirage"` |
| `radarImageRef` | string | Chemin vers l'image de radar utilisée comme fond du panneau position |

### Lineup

| Champ | Type | Description |
|---|---|---|
| `id` | uuid | Identifiant unique |
| `mapId` | string (FK) | Référence vers `Map.id` |
| `side` | enum `Side` | `"T"` ou `"CT"` |
| `grenadeType` | enum `GrenadeType` | `"smoke"`, `"flash"`, `"molotov"`, `"he"`, `"decoy"` |
| `category` | enum `"standard"` \| `"instant"` | `"instant"` pour les lineups à jouer au tout début de la manche depuis un point de spawn fixe |
| `spawnPoint` | string (optionnel) | Identifiant du point de spawn (ex. `"CT1"`…`"CT5"`), renseigné uniquement si `category = "instant"` |
| `spotName` | string | Nom court affiché, ex. `"Palace smoke"`. Pour un instant smoke, sert aussi de clé de regroupement : tous les spawns visant la même cible partagent le même `spotName` |
| `notes` | string | Note libre, ex. instructions générales |
| `favorite` | boolean | Mis en avant dans la navigation |
| `source` | enum `"manual"` \| `"plugin_capture"` \| `"mixed"` | Comment le lineup a été créé (voir note plus bas) — `"mixed"` si certains waypoints sont capturés et d'autres saisis à la main |
| `createdAt` / `updatedAt` | timestamp | Horodatage |
| `waypoints` | `Waypoint[]` | Liste ordonnée, au moins un élément, le dernier est toujours de type `"throw"` |

### Waypoint

| Champ | Type | Description |
|---|---|---|
| `order` | int | Position dans la séquence, à partir de 1 |
| `type` | enum `"checkpoint"` \| `"throw"` | Seul le dernier waypoint peut être `"throw"` |
| `referenceType` | enum `"position"` \| `"aim"` \| `"both"` | Quelle donnée fait foi pour valider ce point. `"both"` est réservé au waypoint de type `"throw"` |
| `position` | `{ x, y, z: float }` | Coordonnées joueur (capturées via GSI ou saisies manuellement) |
| `viewAngle` | `{ yaw, pitch: float }` | Direction de la visée |
| `movement` | enum `Movement` | `"stand"`, `"walk"`, `"run"`, `"jump"` — état de déplacement requis à ce point |
| `clickType` | enum `ClickType` | `"left"`, `"right"`, `"middle"` — uniquement renseigné si `type = "throw"` |
| `screenshotRef` | string (optionnel) | Capture d'écran de référence, utile surtout pour un `referenceType = "aim"` |
| `description` | string (optionnel) | Instruction courte spécifique à ce point, ex. `"Alignez l'antenne avec le mur"` |
| `captured` | boolean | `true` si `position`/`viewAngle` proviennent du plugin serveur, `false` si saisis ou ajustés manuellement |

## Enums

```
Side          = "T" | "CT"
GrenadeType   = "smoke" | "flash" | "molotov" | "he" | "decoy"
Movement      = "stand" | "walk" | "run" | "jump"
ClickType     = "left" | "right" | "middle"
ReferenceType = "position" | "aim" | "both"
WaypointType  = "checkpoint" | "throw"
```

Le libellé affiché dans l'interface (ex. « Jumpthrow », « Runthrow ») peut être dérivé automatiquement de la combinaison `movement` + `clickType` du waypoint de type `throw`, plutôt que stocké séparément — ça évite les incohérences entre les deux champs.

## Exemple JSON complet

Lineup à deux étapes (checkpoint par alignement visuel, puis lancer), correspondant à l'exemple utilisé dans les maquettes :

```json
{
  "id": "a1b2c3d4-0000-0000-0000-000000000001",
  "mapId": "mirage",
  "side": "CT",
  "grenadeType": "smoke",
  "spotName": "Palace smoke",
  "notes": "Bloque la vue depuis Palace vers mid.",
  "favorite": false,
  "source": "plugin_capture",
  "createdAt": "2026-08-01T10:00:00Z",
  "updatedAt": "2026-08-01T10:00:00Z",
  "waypoints": [
    {
      "order": 1,
      "type": "checkpoint",
      "referenceType": "aim",
      "position": { "x": 123.4, "y": 456.7, "z": 12.0 },
      "viewAngle": { "yaw": 45.2, "pitch": -3.1 },
      "movement": "walk",
      "description": "Alignez l'antenne avec le mur",
      "captured": true
    },
    {
      "order": 2,
      "type": "throw",
      "referenceType": "both",
      "position": { "x": 130.0, "y": 460.0, "z": 12.0 },
      "viewAngle": { "yaw": 50.0, "pitch": -10.0 },
      "movement": "jump",
      "clickType": "left",
      "description": "Sautez et lancez au point le plus haut",
      "captured": true
    }
  ]
}
```

Pour un lineup simple (cas le plus fréquent), le tableau `waypoints` ne contient qu'un seul élément de type `"throw"`.

### SpawnPoint

Référentiel des points de spawn, capturé une seule fois par carte et par camp, puis réutilisé pour créer tous les instant smokes de cette carte sans avoir à s'y rendre à pied à chaque fois.

| Champ | Type | Description |
|---|---|---|
| `id` | uuid | Identifiant unique |
| `mapId` | string (FK) | Référence vers `Map.id` |
| `side` | enum `Side` | `"T"` ou `"CT"` |
| `index` | int | Numéro du spawn (1 à 5 généralement) |
| `position` | `{ x, y, z: float }` | Coordonnées capturées une fois via le plugin |

## Lineups instantanés (instant smokes)

Certains lineups doivent être joués dès la première seconde de la manche, depuis le point de spawn — sans déplacement. La position ne varie donc pas vraiment (elle est fixée par le spawn), seule la **visée** change d'un spawn à l'autre pour atteindre la même cible.

Ces lineups partagent le même `mapId`, `side`, et `spotName` (ex. tous les `"Window smoke"` de Mirage), mais diffèrent par leur `spawnPoint`. Pour afficher tous les spawns d'une même cible en une fois :

```
lineups.filter(l =>
  l.mapId === "mirage" &&
  l.side === "CT" &&
  l.spotName === "Window smoke" &&
  l.category === "instant"
)
```

Aucune nouvelle entité n'est nécessaire — le regroupement se fait par requête sur les champs existants plutôt que par une relation explicite.

**Création via téléportation aux spawns** : une fois les `SpawnPoint` d'une carte capturés (une seule fois, au premier instant tranquille sur le serveur local), créer un nouvel instant smoke consiste à répéter, pour chaque spawn : téléporter le joueur à `SpawnPoint.position` (même mécanisme que « tester le lineup »), viser la cible, puis capturer le waypoint de lancer. Aucun déplacement à pied n'est nécessaire pendant la création.

## Capture en direct via plugin serveur local

Le Game State Integration natif de CS2 ne transmet la position et l'angle de vue en direct que pour un joueur en mode spectateur, jamais pour le joueur qui est en train de jouer activement — il n'est donc pas utilisable pour ce cas d'usage. La méthode retenue s'appuie plutôt sur un plugin installé sur le serveur local (Metamod:Source + CounterStrikeSharp), qui peut lire la position et l'angle de vue du joueur actif directement côté serveur, sans cette restriction.

Fonctionnement prévu :

1. Le plugin expose un point d'accès local (HTTP) donnant la position et l'angle de vue courants du joueur.
2. Pendant une partie offline sur le serveur local, l'utilisateur clique sur « capturer » dans le logiciel.
3. Le logiciel interroge ce point d'accès et remplit automatiquement `position` et `viewAngle` du waypoint en cours, en passant `captured` à `true`.
4. La valeur capturée reste modifiable manuellement ensuite (ex. ajustement fin après un test in-game), sans perdre la trace qu'elle provient d'une capture en direct.

Cette approche demande une installation ponctuelle du plugin sur le serveur local, mais évite toute saisie manuelle de coordonnées pendant le travail de création d'un lineup.

**Capture d'écran (`screenshotRef`)** : contrairement à `position`/`viewAngle`, l'image ne provient pas du plugin ni du jeu — CS2 ne permet pas à un plugin serveur d'accéder au rendu du client, cette donnée n'existant que côté machine du joueur. Comme le serveur et le client tournent sur la même machine en local, le logiciel capture lui-même l'écran ou la fenêtre du jeu (capture native au niveau du système d'exploitation) au moment du clic sur « capturer », en parallèle de la requête au plugin. Les deux actions sont déclenchées ensemble mais restent deux mécanismes indépendants.
