// Fonctions pures (aucun accès à `document`/`window.pywebview`/`state`) extraites de
// main.js pour être testables sans DOM ni backend — voir logic.test.js (node --test).
// Chargé via <script src="logic.js"> avant main.js (index.html), qui continue d'appeler
// ces fonctions par leur nom global exactement comme avant l'extraction.
(function (root) {
  // Petits pictogrammes inline (pas d'assets SVG dans le repo) — une silhouette
  // distincte par type plutôt qu'une simple pastille de couleur, pour rester
  // lisibles une fois miniaturisés sur le radar plein écran.
  const GRENADE_ICONS = {
    smoke: '<svg viewBox="0 0 20 20" width="20" height="20"><circle cx="7" cy="12" r="5" fill="#9ca3af"/><circle cx="12" cy="9" r="5.5" fill="#d1d5db"/><circle cx="13" cy="14" r="4" fill="#9ca3af"/></svg>',
    flash: '<svg viewBox="0 0 20 20" width="20" height="20"><path d="M10 1 L12 8 L18 8 L11 13 L13 19 L10 15 L7 19 L9 13 L2 8 L8 8 Z" fill="#fbbf24" stroke="#78350f" stroke-width="0.5"/></svg>',
    molotov: '<svg viewBox="0 0 20 20" width="20" height="20"><path d="M8 3 L12 3 L11 7 L14 10 Q15 14 10 17 Q5 14 6 10 L9 7 Z" fill="#f97316"/><rect x="8.5" y="1" width="3" height="2.5" fill="#78350f"/></svg>',
    he: '<svg viewBox="0 0 20 20" width="20" height="20"><circle cx="10" cy="11" r="7" fill="#4d7c0f"/><rect x="8.5" y="2" width="3" height="3" fill="#3f3f46"/><path d="M4 8 L16 14 M4 14 L16 8" stroke="#1a2e05" stroke-width="1"/></svg>',
    decoy: '<svg viewBox="0 0 20 20" width="20" height="20"><rect x="4" y="5" width="12" height="11" rx="1.5" fill="#a16207"/><rect x="4" y="5" width="12" height="3" fill="#78350f"/></svg>',
  };

  function grenadeIconSvg(type) {
    return GRENADE_ICONS[type] || GRENADE_ICONS.smoke;
  }

  // Icône dédiée pour un cluster regroupant des lineups de plusieurs types de
  // grenade (regroupement par proximité, pas par type — voir clusterByProximity) :
  // afficher l'icône d'un seul type (ex. le premier du cluster) laisserait croire
  // que tous les lineups regroupés sont de ce type (bug signalé).
  const MIXED_TYPES_ICON =
    '<svg viewBox="0 0 20 20" width="20" height="20"><circle cx="10" cy="10" r="9" fill="#6b7280"/><line x1="10" y1="5" x2="10" y2="15" stroke="#fff" stroke-width="2"/><line x1="5" y1="10" x2="15" y2="10" stroke="#fff" stroke-width="2"/></svg>';

  function clusterIconSvg(grenadeTypes) {
    const unique = [...new Set(grenadeTypes)];
    return unique.length === 1 ? grenadeIconSvg(unique[0]) : MIXED_TYPES_ICON;
  }

  function hasRadarCalibration(map) {
    return !!map && map.radarPosX != null && map.radarPosY != null && map.radarScale != null;
  }

  function worldToRadarPercent(map, x, y) {
    const px = (x - map.radarPosX) / map.radarScale;
    const py = (map.radarPosY - y) / map.radarScale;
    return { leftPct: (px / 1024) * 100, topPct: (py / 1024) * 100 };
  }

  // Calcule un cadrage (échelle + décalage, en % de l'image 0-100) qui zoome sur le
  // cluster de points donnés plutôt que d'afficher toute la carte — utilisé pour les
  // spawns d'instant smokes, groupés sur une petite zone contrairement aux positions
  // de lancer classiques dispersées sur toute la carte.
  function computeZoomFrame(points, paddingFrac = 0.35, minSpanPct = 12) {
    const xs = points.map((p) => p.leftPct);
    const ys = points.map((p) => p.topPct);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const span = Math.max(maxX - minX, maxY - minY, minSpanPct) * (1 + paddingFrac);
    const half = span / 2;
    const cx = Math.min(Math.max((minX + maxX) / 2, half), 100 - half);
    const cy = Math.min(Math.max((minY + maxY) / 2, half), 100 - half);
    return { minX: cx - half, minY: cy - half, span };
  }

  function zoomedPercentX(pct, frame) {
    return (pct - frame.minX) * (100 / frame.span);
  }

  function zoomedPercentY(pct, frame) {
    return (pct - frame.minY) * (100 / frame.span);
  }

  // Clé de regroupement composite side::spotName — nécessaire depuis que le filtre
  // camp peut être "Tous" (side === null) : sans le side dans la clé, un groupe CT et
  // un groupe T portant le même spotName fusionneraient à tort.
  function groupKey(g) {
    return `${g.side}::${g.spotName}`;
  }

  // Regroupement glouton par proximité visuelle (en px, sur la taille actuelle du
  // radar) — évite que deux lineups du même type de grenade capturés à quelques
  // unités d'écart se recouvrent en deux icônes illisibles. Un cluster garde le
  // centroïde de ses membres, recalculé à chaque ajout.
  function clusterByProximity(points, thresholdPx) {
    const clusters = [];
    for (const p of points) {
      const cluster = clusters.find(
        (c) => Math.hypot(c.leftPx - p.leftPx, c.topPx - p.topPx) <= thresholdPx
      );
      if (cluster) {
        cluster.items.push(p.lineup);
        cluster.leftPx = (cluster.leftPx * (cluster.items.length - 1) + p.leftPx) / cluster.items.length;
        cluster.topPx = (cluster.topPx * (cluster.items.length - 1) + p.topPx) / cluster.items.length;
      } else {
        clusters.push({ leftPx: p.leftPx, topPx: p.topPx, items: [p.lineup] });
      }
    }
    return clusters;
  }

  // Texte/variante du badge de map serveur (voir #serverMapBadge dans index.html) —
  // purement informatif, ne synchronise jamais le filtre affiché (state.filters.mapId
  // reste manuel, voir CLAUDE.md / décision utilisateur sur le mismatch map serveur).
  function computeServerMapBadge(serverMapName, filterMapId) {
    if (!serverMapName) return { text: "Serveur injoignable", variant: "warn" };
    const matchesFilter = !filterMapId || serverMapName === `de_${filterMapId}`;
    return { text: `Serveur : ${serverMapName}`, variant: matchesFilter ? "neutral" : "warn" };
  }

  const exported = {
    GRENADE_ICONS,
    grenadeIconSvg,
    clusterIconSvg,
    hasRadarCalibration,
    worldToRadarPercent,
    computeZoomFrame,
    zoomedPercentX,
    zoomedPercentY,
    groupKey,
    clusterByProximity,
    computeServerMapBadge,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = exported;
  } else {
    Object.assign(root, exported);
  }
})(typeof window !== "undefined" ? window : globalThis);
