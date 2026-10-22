// Stub de window.pywebview.api injecté avant le chargement de la page (voir
// page.addInitScript dans les specs) — remplace le vrai pont pywebview↔Python par
// des données fixtures déterministes. Aucun process Python, aucune fenêtre native,
// aucun CS2 requis : ces tests couvrent le rendu/la logique JS réels dans un vrai
// Chromium, pas le bridge natif ni le backend (voir la note "pas du vrai E2E" dans
// le plan de tests — cette couche est volontairement une UI d'intégration à
// frontière mockée, pas un test de bout en bout complet).

const MAPS = [
  {
    id: "mirage",
    displayName: "Mirage",
    radarImageRef: "radar/mirage.png",
    radarPosX: -3230,
    radarPosY: 1713,
    radarScale: 5,
  },
  // Carte calibrée mais sans aucun lineup enregistré — reproduit le cas "aucun
  // waypoint sélectionnable" (voir browse.spec.js : le radar doit rester visible,
  // juste sans marqueur).
  {
    id: "ancient",
    displayName: "Ancient",
    radarImageRef: "radar/ancient.png",
    radarPosX: -2953,
    radarPosY: 2164,
    radarScale: 5,
  },
];

const LINEUPS = [
  {
    id: "std-window",
    mapId: "mirage",
    side: "CT",
    grenadeType: "smoke",
    category: "standard",
    spawnPoint: null,
    spotName: "Window smoke",
    notes: "Depuis le mid, contre le rebord.",
    favorite: false,
    source: "manual",
    createdAt: "2026-01-01T00:00:00+00:00",
    updatedAt: "2026-01-01T00:00:00+00:00",
    throwLabel: "Jumpthrow",
    waypoints: [
      {
        order: 1,
        type: "throw",
        referenceType: "both",
        position: { x: 100, y: 200, z: 0 },
        viewAngle: { yaw: 0, pitch: 0 },
        movement: "jump",
        clickType: "left",
        screenshotRef: "shot-std-window.png",
        screenshotZoomRef: "shot-std-window-zoom.png",
        description: null,
        captured: true,
      },
    ],
  },
  {
    id: "std-ramp",
    mapId: "mirage",
    side: "CT",
    grenadeType: "flash",
    category: "standard",
    spawnPoint: null,
    spotName: "Ramp flash",
    notes: "",
    favorite: false,
    source: "manual",
    createdAt: "2026-01-01T00:00:01+00:00",
    updatedAt: "2026-01-01T00:00:01+00:00",
    throwLabel: null,
    waypoints: [
      {
        order: 1,
        type: "throw",
        referenceType: "both",
        position: { x: 300, y: 400, z: 0 },
        viewAngle: { yaw: 0, pitch: 0 },
        movement: "stand",
        clickType: "left",
        screenshotRef: "shot-std-ramp.png",
        screenshotZoomRef: null,
        description: null,
        captured: true,
      },
    ],
  },
  {
    id: "instant-1",
    mapId: "mirage",
    side: "T",
    grenadeType: "smoke",
    category: "instant",
    spawnPoint: "spawn-1",
    spotName: "Instant window",
    notes: "",
    favorite: false,
    source: "plugin_capture",
    createdAt: "2026-01-01T00:00:02+00:00",
    updatedAt: "2026-01-01T00:00:02+00:00",
    throwLabel: "Runthrow",
    waypoints: [
      {
        order: 1,
        type: "throw",
        referenceType: "both",
        position: { x: 10, y: 10, z: 0 },
        viewAngle: { yaw: 0, pitch: 0 },
        movement: "run",
        clickType: "left",
        screenshotRef: "shot-instant-1.png",
        screenshotZoomRef: null,
        description: null,
        captured: true,
      },
    ],
  },
  {
    id: "instant-2",
    mapId: "mirage",
    side: "T",
    grenadeType: "smoke",
    category: "instant",
    spawnPoint: "spawn-2",
    spotName: "Instant window",
    notes: "",
    favorite: false,
    source: "plugin_capture",
    createdAt: "2026-01-01T00:00:03+00:00",
    updatedAt: "2026-01-01T00:00:03+00:00",
    throwLabel: null,
    waypoints: [],
  },
  // Deux lineups standards de même type (smoke), même position que "std-window" —
  // pour le radar plein écran, doivent se regrouper sous une seule icône avec un
  // badge "2" (voir radar-fullscreen.spec.js).
  {
    id: "std-window-2",
    mapId: "mirage",
    side: "CT",
    grenadeType: "smoke",
    category: "standard",
    spawnPoint: null,
    spotName: "Window smoke (dup)",
    notes: "",
    favorite: false,
    source: "manual",
    createdAt: "2026-01-01T00:00:04+00:00",
    updatedAt: "2026-01-01T00:00:04+00:00",
    throwLabel: null,
    waypoints: [
      {
        order: 1,
        type: "throw",
        referenceType: "both",
        position: { x: 100, y: 200, z: 0 }, // identique à std-window
        viewAngle: { yaw: 0, pitch: 0 },
        movement: "stand",
        clickType: "left",
        screenshotRef: "shot-std-window-2.png",
        screenshotZoomRef: null,
        description: null,
        captured: true,
      },
    ],
  },
  // Type DIFFÉRENT (flash) mais même position que "std-window" — doit fusionner
  // dans le même cluster (regroupement par proximité, pas par type). Reproduit le
  // bug signalé : sans ça, cette icône se superposait pile sur la smoke, invisible.
  {
    id: "std-window-flash",
    mapId: "mirage",
    side: "CT",
    grenadeType: "flash",
    category: "standard",
    spawnPoint: null,
    spotName: "Window flash",
    notes: "",
    favorite: false,
    source: "manual",
    createdAt: "2026-01-01T00:00:04+00:00",
    updatedAt: "2026-01-01T00:00:04+00:00",
    throwLabel: null,
    waypoints: [
      {
        order: 1,
        type: "throw",
        referenceType: "both",
        position: { x: 100, y: 200, z: 0 }, // identique à std-window, type différent
        viewAngle: { yaw: 0, pitch: 0 },
        movement: "stand",
        clickType: "left",
        screenshotRef: "shot-std-window-flash.png",
        screenshotZoomRef: null,
        description: null,
        captured: true,
      },
    ],
  },
  // Smoke isolé, très éloigné du cluster ci-dessus — doit rester sélectionnable
  // directement (pas de badge, pas de popover).
  {
    id: "std-far-smoke",
    mapId: "mirage",
    side: "CT",
    grenadeType: "smoke",
    category: "standard",
    spawnPoint: null,
    spotName: "Far smoke",
    notes: "",
    favorite: false,
    source: "manual",
    createdAt: "2026-01-01T00:00:05+00:00",
    updatedAt: "2026-01-01T00:00:05+00:00",
    throwLabel: null,
    waypoints: [
      {
        order: 1,
        type: "throw",
        referenceType: "both",
        position: { x: -3180, y: 1713, z: 0 },
        viewAngle: { yaw: 0, pitch: 0 },
        movement: "stand",
        clickType: "left",
        screenshotRef: "shot-std-far-smoke.png",
        screenshotZoomRef: null,
        description: null,
        captured: true,
      },
    ],
  },
  // Cluster de 2 lineups (même type, mêmes coordonnées) tout près du bord droit du
  // radar (leftPct ~92%) — reproduit le popover coupé signalé par l'utilisateur
  // quand le marqueur cliqué est proche d'un bord (voir radar-fullscreen.spec.js).
  {
    id: "std-edge-1",
    mapId: "mirage",
    side: "CT",
    grenadeType: "he",
    category: "standard",
    spawnPoint: null,
    spotName: "Edge HE 1",
    notes: "",
    favorite: false,
    source: "manual",
    createdAt: "2026-01-01T00:00:06+00:00",
    updatedAt: "2026-01-01T00:00:06+00:00",
    throwLabel: null,
    waypoints: [
      {
        order: 1,
        type: "throw",
        referenceType: "both",
        position: { x: 1480, y: 200, z: 0 },
        viewAngle: { yaw: 0, pitch: 0 },
        movement: "stand",
        clickType: "left",
        screenshotRef: "shot-std-edge-1.png",
        screenshotZoomRef: null,
        description: null,
        captured: true,
      },
    ],
  },
  {
    id: "std-edge-2",
    mapId: "mirage",
    side: "CT",
    grenadeType: "he",
    category: "standard",
    spawnPoint: null,
    spotName: "Edge HE 2",
    notes: "",
    favorite: false,
    source: "manual",
    createdAt: "2026-01-01T00:00:07+00:00",
    updatedAt: "2026-01-01T00:00:07+00:00",
    throwLabel: null,
    waypoints: [
      {
        order: 1,
        type: "throw",
        referenceType: "both",
        position: { x: 1480, y: 200, z: 0 },
        viewAngle: { yaw: 0, pitch: 0 },
        movement: "stand",
        clickType: "left",
        screenshotRef: "shot-std-edge-2.png",
        screenshotZoomRef: null,
        description: null,
        captured: true,
      },
    ],
  },
];

const SPAWNPOINTS = [
  { id: "spawn-1", mapId: "mirage", side: "T", index: 1, position: { x: 10, y: 10, z: 0 } },
  // Assez éloigné de spawn-1 pour que les deux marqueurs ne se chevauchent jamais
  // visuellement sur le radar zoomé (le marqueur sélectionné grossit à 24px).
  { id: "spawn-2", mapId: "mirage", side: "T", index: 2, position: { x: 400, y: 10, z: 0 } },
];

function matches(lineup, mapId, side, grenadeType, category) {
  if (mapId != null && lineup.mapId !== mapId) return false;
  if (side != null && lineup.side !== side) return false;
  if (grenadeType != null && lineup.grenadeType !== grenadeType) return false;
  if (category != null && lineup.category !== category) return false;
  return true;
}

// Id du lineup en cours d'édition côté "serveur" simulé — posé par start_edit_capture,
// lu par save_capture pour renvoyer le bon objet (voir openEditLineupView/saveCapture
// dans main.js, qui ne renvoient jamais les champs du formulaire eux-mêmes : le vrai
// backend Python maintient une session de capture, ce stub imite juste assez ce
// comportement pour couvrir le flux édition instant, voir instant-lineup-edit.spec.js).
let editingCaptureId = null;

window.pywebview = {
  api: {
    get_mode: async () => "full",
    get_maps: async () => MAPS,
    get_lineups: async (mapId, side, grenadeType, category) =>
      LINEUPS.filter((l) => matches(l, mapId, side, grenadeType, category)),
    get_spawnpoints: async (mapId, side) =>
      SPAWNPOINTS.filter((s) => (mapId == null || s.mapId === mapId) && (side == null || s.side === side)),
    // Préfixe distinct par fonction pour pouvoir vérifier dans les tests QUELLE
    // fonction a fourni l'image affichée, pas juste qu'une image existe.
    get_asset_data_url: async (ref) => `data:image/png;base64,ASSET_${ref}`,
    get_screenshot_detail_data_url: async (ref) => `data:image/png;base64,DETAIL_${ref}`,
    get_screenshot_data_url: async (ref) => `data:image/png;base64,ZOOM_${ref}`,
    set_active_lineup: async () => {},
    // Aucun scénario e2e ne couvre encore le mismatch de map (nécessiterait un
    // vrai serveur CS2) — un serveur toujours joignable et aligné sur la map
    // active suffit pour que initInner()/le badge ne cassent pas les autres specs.
    get_server_map_name: async () => `de_${MAPS[0].id}`,
    change_server_map: async () => ({ status: "ok" }),
    teleport_to_spawn: async () => ({ status: "ok" }),
    toggle_favorite: async (id) => ({ status: "ok", lineup: LINEUPS.find((l) => l.id === id) }),
    delete_lineup: async (id) => {
      const index = LINEUPS.findIndex((l) => l.id === id);
      if (index !== -1) LINEUPS.splice(index, 1);
      return { status: index !== -1 ? "deleted" : "error" };
    },
    delete_lineups: async (ids) => {
      const before = LINEUPS.length;
      for (let i = LINEUPS.length - 1; i >= 0; i--) {
        if (ids.includes(LINEUPS[i].id)) LINEUPS.splice(i, 1);
      }
      return { status: "ok", deleted: before - LINEUPS.length };
    },
    get_library_count: async () => LINEUPS.length,
    delete_library: async () => {
      const deleted = LINEUPS.length;
      LINEUPS.length = 0;
      return { status: "ok", deleted };
    },
    delete_instant_group: async (mapId, side, spotName) => {
      const before = LINEUPS.length;
      for (let i = LINEUPS.length - 1; i >= 0; i--) {
        const l = LINEUPS[i];
        if (l.mapId === mapId && l.side === side && l.category === "instant" && l.spotName === spotName) {
          LINEUPS.splice(i, 1);
        }
      }
      return { status: "ok", deleted: before - LINEUPS.length };
    },
    start_edit_capture: async (id) => {
      editingCaptureId = id;
      return {};
    },
    update_capture_fields: async () => ({ waypoint: null }),
    cancel_capture: async () => {
      editingCaptureId = null;
    },
    save_capture: async () => {
      const lineup = LINEUPS.find((l) => l.id === editingCaptureId);
      return { status: "saved", lineup };
    },
  },
};
