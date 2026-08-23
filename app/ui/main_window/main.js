// Icônes de la barre d'outils (sélection/export/import) — traits type Feather Icons
// (stroke="currentColor", suit la couleur du texte du bouton dans les deux thèmes).
const TOOLBAR_ICONS = {
  select:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  close:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  download:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  upload:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
  trash:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
  plus:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>',
  star:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/></svg>',
  starFilled:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/></svg>',
  pencil:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>',
  panelLeft:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>',
  arrowLeft:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>',
  save:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg>',
  eye:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/></svg>',
  target:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
  map:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/></svg>',
};

function setButtonIcon(buttonId, iconKey) {
  document.getElementById(buttonId).insertAdjacentHTML("afterbegin", TOOLBAR_ICONS[iconKey]);
}

// Contrairement à setButtonIcon (ajoute une fois, à l'init, devant un texte qui ne
// change jamais), remplace tout le contenu — pour les boutons dont l'icône reflète
// un état qui bascule (favori, HUD affiché/masqué).
function setButtonIconOnly(buttonId, iconKey) {
  document.getElementById(buttonId).innerHTML = TOOLBAR_ICONS[iconKey];
}

function initToolbarIcons() {
  setButtonIcon("btnSelectionMode", "select");
  setButtonIcon("btnExportSelection", "upload");
  setButtonIcon("btnDeleteSelection", "trash");
  // Export = envoyer un fichier hors de l'app (flèche vers le haut, comme
  // "partager") ; Import = faire entrer un fichier dans la bibliothèque
  // (flèche vers le bas, comme "recevoir") — inversé par rapport aux icônes
  // Feather d'origine "download"/"upload" (bug signalé par l'utilisateur).
  setButtonIcon("btnExportLibrary", "upload");
  setButtonIcon("btnImportLineups", "download");
  setButtonIcon("btnNewLineup", "plus");
  setButtonIcon("btnEditLineup", "pencil");
  setButtonIcon("btnDeleteLineup", "trash");
  setButtonIcon("btnDeleteSpawnLineup", "trash");
  setButtonIcon("btnDeleteInstantGroup", "trash");
  setButtonIcon("btnOpenSpawnLineup", "pencil");
  setButtonIcon("btnToggleLineupPanel", "panelLeft");
  setButtonIcon("btnCloseRadarFullscreen", "arrowLeft");
  setButtonIcon("btnCancelCreate", "close");
  setButtonIcon("btnTeleportSpawn", "target");
  setButtonIcon("btnFixMapMismatch", "map");
  setButtonIconOnly("btnSaveCapture", "save");
  setButtonIconOnly("btnToggleHud", "eye");
  document.getElementById("side-CT").innerHTML = sideIconSvg("CT");
  document.getElementById("side-T").innerHTML = sideIconSvg("T");
  document.getElementById("form-side-CT").innerHTML = sideIconSvg("CT");
  document.getElementById("form-side-T").innerHTML = sideIconSvg("T");
}

const GRENADE_TYPES = ["smoke", "flash", "molotov", "he", "decoy"];
const GRENADE_LABELS = { smoke: "Smoke", flash: "Flash", molotov: "Molotov", he: "HE", decoy: "Decoy" };

// grenadeIconSvg, clusterIconSvg, hasRadarCalibration, worldToRadarPercent,
// computeZoomFrame, zoomedPercentX/Y, groupKey, clusterByProximity : voir logic.js
// (fonctions pures, testées sans DOM dans logic.test.js — chargé avant ce fichier
// dans index.html).

const state = {
  mode: "full",
  maps: [],
  lineups: [],
  filters: { mapId: null, side: null, grenadeType: null, instantOnly: false },
  search: "",
  selectedLineupId: null,
  selectedInstantSpot: null,
  serverMapName: null,
  selectionMode: false,
  selectedIds: new Set(),
};

// Non-null lorsque #view-create est ouverte en mode édition (bouton Éditer) plutôt
// qu'en création — voir openEditLineupView/armCapture/saveCapture.
let editingLineupId = null;

// Incrémenté à chaque renderLineups() — les rendus async (fetch de screenshots,
// spawns...) vérifient qu'ils sont toujours la dernière génération avant d'écrire
// dans le DOM, sinon un rendu lent (vue groupée, plusieurs fetch en série) peut
// se terminer APRÈS un rendu plus récent et écraser son résultat avec du contenu
// périmé (radar/zoom d'un autre lineup affichés par-dessus le bon).
let renderGeneration = 0;

function api() {
  return window.pywebview.api;
}

// --- Radar (voir CLAUDE.md pour la formule de calibration) ---
// hasRadarCalibration/worldToRadarPercent/computeZoomFrame/zoomedPercentX/Y : logic.js

function setRadarMarker(markerEl, leftPct, topPct) {
  markerEl.style.left = `${leftPct}%`;
  markerEl.style.top = `${topPct}%`;
  markerEl.classList.remove("hidden");
}

function applyZoomFrameToImage(img, frame) {
  const scale = 100 / frame.span;
  img.style.width = `${scale * 100}%`;
  img.style.height = `${scale * 100}%`;
  img.style.left = `${-frame.minX * scale}%`;
  img.style.top = `${-frame.minY * scale}%`;
}

// Rend un radar zoomé avec un marqueur numéroté par point (spawns) — réutilisé pour
// le picker de spawn en création et pour la vue groupée instant smoke en bibliothèque.
// `points` : [{ leftPct, topPct, label, done, selected, side, onClick }]
function renderSpawnMarkers(wrap, points) {
  for (const el of wrap.querySelectorAll(".instant-marker")) el.remove();
  if (points.length === 0) return;

  const frame = computeZoomFrame(points);
  const img = wrap.querySelector("img");
  if (img) {
    img.style.position = "absolute";
    applyZoomFrameToImage(img, frame);
  }

  for (const p of points) {
    const el = document.createElement(p.onClick ? "button" : "div");
    el.className =
      "instant-marker" +
      (p.onClick ? "" : " static") +
      (p.done ? " done" : "") +
      (p.selected ? " selected" : "") +
      (p.side ? ` ${sideClassName(p.side)}` : "");
    // position posée en inline en plus de la classe CSS — un marqueur en flux
    // normal (position par défaut "static") ignore left/top et se fait couper
    // par l'overflow:hidden du wrap, invisible sans erreur ni avertissement.
    el.style.position = "absolute";
    el.style.left = `${zoomedPercentX(p.leftPct, frame)}%`;
    el.style.top = `${zoomedPercentY(p.topPct, frame)}%`;
    el.textContent = p.label;
    if (p.onClick) el.onclick = p.onClick;
    wrap.appendChild(el);
  }
}

// pywebview sert les fichiers via son propre serveur local, qui bloque la remontée de
// dossiers ("..") — on charge donc les images radar en data URI via l'API Python plutôt
// que par un chemin relatif direct.
async function setRadarImageSrc(imgEl, radarImageRef) {
  const dataUrl = await api().get_asset_data_url(radarImageRef);
  if (dataUrl) {
    imgEl.src = dataUrl;
  } else {
    imgEl.removeAttribute("src");
  }
}

// --- Badge de map serveur (purement informatif, voir computeServerMapBadge dans
// logic.js) — poussé depuis Python à chaque changement de map détecté par le thread
// de polling existant (_poll_overlay_visibility, voir main.py), plus un appel direct
// au chargement pour peindre le badge avant le premier tick de ce polling. ---

function refreshServerMapBadge() {
  const badge = document.getElementById("serverMapBadge");
  const { text, variant } = computeServerMapBadge(state.serverMapName, state.filters.mapId);
  badge.textContent = text;
  badge.classList.remove("hidden");
  badge.classList.toggle("warn", variant === "warn");
}

function onServerMapChanged(mapName) {
  state.serverMapName = mapName;
  refreshServerMapBadge();
}
window.onServerMapChanged = onServerMapChanged;

function showFatalError(err) {
  const el = document.getElementById("detailSpotName");
  if (el) el.textContent = "Erreur JS : " + (err && err.message ? err.message : err);
  console.error(err);
}
window.addEventListener("error", (e) => showFatalError(e.error || e.message));
// Un appel api().xxx() qui rejette (ex. exception Python) sans .catch() ni try/catch
// autour de son await passe inaperçu ("error" ne capte que les exceptions synchrones)
// — on le rend visible ici plutôt que de le laisser échouer silencieusement.
window.addEventListener("unhandledrejection", (e) => showFatalError(e.reason));

async function init() {
  try {
    await initInner();
  } catch (err) {
    showFatalError(err);
  }
}

// Icône dans chaque option des <select> "Type de grenade"/"Clic" — un <option>
// natif ne peut pas afficher de HTML de façon fiable (la nouvelle API CSS pour
// ça, appearance:base-select, reste derrière un drapeau expérimental non activé
// par défaut, vérifié en conditions réelles). SlimSelect habille le <select>
// d'origine (vendored, voir vendor/) sans toucher à sa valeur ni son
// comportement de formulaire — seul le rendu visuel change.
// Instances SlimSelect des deux <select> à icônes — gardées à portée de module
// car définir `.value` directement sur le <select> d'origine (ex. pré-remplissage
// en édition, voir setGrenadeTypeValue/setClickTypeValue) ne déclenche pas
// d'événement "change" et ne rafraîchit donc pas l'affichage custom de SlimSelect ;
// il faut passer par son API (`.setSelected(...)`) pour rester synchronisé.
let grenadeTypeSelect = null;
let clickTypeSelect = null;

const CLICK_LABELS = { left: "Gauche", right: "Droit", middle: "Milieu" };

function populateIconSelects() {
  grenadeTypeSelect = new SlimSelect({
    select: "#form-grenadeType",
    data: GRENADE_TYPES.map((gt) => ({
      value: gt,
      text: GRENADE_LABELS[gt],
      html: `<span class="option-icon">${grenadeIconSvg(gt)}</span>${GRENADE_LABELS[gt]}`,
    })),
    // Un choix fait dans l'UI custom de SlimSelect doit réarmer la capture
    // exactement comme un <select> natif (voir la boucle "input"/armCapture
    // plus bas) — ne pas dépendre du fait que SlimSelect répercute ou non un
    // événement natif sur le <select> d'origine.
    events: { afterChange: () => armCapture() },
    settings: { showSearch: false },
  });
  clickTypeSelect = new SlimSelect({
    select: "#form-clickType",
    data: Object.keys(CLICK_LABELS).map((ct) => ({
      value: ct,
      text: CLICK_LABELS[ct],
      html: `<span class="option-icon">${mouseIconSvg(ct)}</span>${CLICK_LABELS[ct]}`,
    })),
    events: { afterChange: () => armCapture() },
    settings: { showSearch: false },
  });
}

function setGrenadeTypeValue(value) {
  grenadeTypeSelect.setSelected([value]);
}

function setClickTypeValue(value) {
  clickTypeSelect.setSelected([value]);
}

async function initInner() {
  initToolbarIcons();
  populateIconSelects();
  state.mode = await api().get_mode();
  document.body.classList.toggle("consultation-mode", state.mode === "consultation");
  state.maps = await api().get_maps();
  const mapSelect = document.getElementById("mapSelect");
  const formMapSelect = document.getElementById("form-mapId");
  mapSelect.innerHTML = "";
  formMapSelect.innerHTML = "";
  for (const m of state.maps) {
    mapSelect.appendChild(new Option(m.displayName, m.id));
    formMapSelect.appendChild(new Option(m.displayName, m.id));
  }
  if (state.maps.length > 0) {
    state.filters.mapId = state.maps[0].id;
    mapSelect.value = state.filters.mapId;
  }

  renderCategoryPills();
  setSide(state.filters.side);
  mapSelect.addEventListener("change", () => {
    state.filters.mapId = mapSelect.value;
    refreshLineups();
    refreshServerMapBadge();
  });

  if (state.mode === "full") {
    state.serverMapName = await api().get_server_map_name();
    refreshServerMapBadge();
  }
  formMapSelect.addEventListener("change", () => {
    if (document.getElementById("form-category").value === "instant") loadInstantSpawnPanel();
    armCapture();
  });
  document.getElementById("form-category").addEventListener("change", () => {
    toggleInstantPanel();
    armCapture();
  });
  // Le brouillon de capture doit toujours refléter le formulaire courant — F9 peut
  // être pressé en jeu à tout moment, sans repasser par l'app pour "valider" les
  // champs d'abord (voir armCapture).
  for (const id of ["form-grenadeType", "form-spotName", "form-notes", "form-movement", "form-clickType"]) {
    document.getElementById(id).addEventListener("input", armCapture);
  }
  document.getElementById("form-crouch").addEventListener("change", armCapture);

  await refreshLineups();
}

// "CT"/"T" -> classe CSS de teinte du camp (voir --ct-*/--t-* dans style.css).
function sideClassName(side) {
  return side === "CT" ? "side-ct" : "side-t";
}

// Pastille de fond derrière l'icône de grenade (voir .icon-badge dans style.css) :
// uniformise la luminosité perçue entre les types (le flash quasi-blanc "brillait"
// bien plus que le smoke gris foncé sur le même fond sombre — bug signalé).
function grenadeIconBadge(type) {
  return `<span class="icon-badge type-${type}">${grenadeIconSvg(type)}</span>`;
}

function renderCategoryPills() {
  const container = document.getElementById("categoryPills");
  container.innerHTML = "";
  for (const gt of GRENADE_TYPES) {
    const btn = document.createElement("button");
    btn.className = "pill icon-btn";
    btn.innerHTML = grenadeIconSvg(gt);
    btn.title = GRENADE_LABELS[gt];
    btn.setAttribute("aria-label", GRENADE_LABELS[gt]);
    btn.onclick = () => toggleGrenadeFilter(gt, btn);
    container.appendChild(btn);
  }
}

function toggleGrenadeFilter(gt, btn) {
  const active = state.filters.grenadeType === gt;
  state.filters.grenadeType = active ? null : gt;
  for (const child of document.getElementById("categoryPills").children) {
    child.classList.toggle("active", !active && child === btn);
  }
  refreshLineups();
}

function setSide(side) {
  state.filters.side = side;
  document.getElementById("side-CT").classList.toggle("active", side === "CT");
  document.getElementById("side-T").classList.toggle("active", side === "T");
  refreshLineups();
}

// Pas de bouton "Tous" distinct : cliquer le camp déjà actif le désélectionne
// (retour à side=null, aucun filtre), cliquer l'autre camp le remplace.
function toggleSide(side) {
  setSide(state.filters.side === side ? null : side);
}

// Toggle CT/T du formulaire de création — contrairement au toggle de filtre
// (toggleSide, qui autorise un état "aucun filtre" désélectionné), une valeur
// CT ou T est toujours requise ici (comportement équivalent à l'ancien <select>).
function setFormSide(side) {
  document.getElementById("form-side").value = side;
  document.getElementById("form-side-CT").classList.toggle("active", side === "CT");
  document.getElementById("form-side-T").classList.toggle("active", side === "T");
}

function selectFormSide(side) {
  setFormSide(side);
  if (document.getElementById("form-category").value === "instant") loadInstantSpawnPanel();
  armCapture();
}

function toggleLineupPanel(force) {
  const wrap = document.getElementById("lineupPanelWrap");
  const open = typeof force === "boolean" ? force : !wrap.classList.contains("open");
  wrap.classList.toggle("open", open);
  document.getElementById("btnToggleLineupPanel").classList.toggle("active", open);
}

// Le panneau pousse .radar-slot (voir .radar-fullscreen-layout, style.css) : sa
// taille en px (fitRadarFullscreenSquare) doit être recalculée une fois la
// transition de largeur terminée, sinon on mesure une taille intermédiaire.
document.getElementById("lineupPanelWrap").addEventListener("transitionend", (evt) => {
  if (evt.propertyName !== "width") return;
  if (!document.getElementById("view-radar-fullscreen").classList.contains("hidden")) {
    fitRadarFullscreenSquare();
  }
});

function onSearchInput() {
  state.search = document.getElementById("searchInput").value.trim().toLowerCase();
  renderLineups();
}

async function refreshLineups() {
  state.lineups = await api().get_lineups(state.filters.mapId, state.filters.side, state.filters.grenadeType);
  if (!state.lineups.some((l) => l.id === state.selectedLineupId)) {
    state.selectedLineupId = null;
  }
  renderLineups();
}

function standardLineups() {
  return state.lineups.filter((l) => l.category !== "instant");
}

// groupKey : logic.js (clé de regroupement composite side::spotName).

// Regroupe les lineups "instant" par side+spotName (mapId déjà filtré par get_lineups).
function instantGroups() {
  const byKey = new Map();
  for (const l of state.lineups) {
    if (l.category !== "instant") continue;
    const key = `${l.side}::${l.spotName}`;
    if (!byKey.has(key)) byKey.set(key, { spotName: l.spotName, side: l.side, grenadeType: l.grenadeType, lineups: [] });
    byKey.get(key).lineups.push(l);
  }
  return [...byKey.values()];
}

function visibleLineups() {
  // Filtre "Instant uniquement" : ne montre aucun lineup standard dans la liste,
  // ceux-ci ont leur propre affichage groupé (voir visibleInstantGroups()).
  if (state.filters.instantOnly) return [];
  const items = standardLineups();
  if (!state.search) return items;
  return items.filter((l) => l.spotName.toLowerCase().includes(state.search));
}

function toggleInstantOnlyFilter() {
  state.filters.instantOnly = !state.filters.instantOnly;
  document.getElementById("instantOnlyToggle").classList.toggle("active", state.filters.instantOnly);
  renderLineups();
}

function visibleInstantGroups() {
  const groups = instantGroups();
  if (!state.search) return groups;
  return groups.filter((g) => g.spotName.toLowerCase().includes(state.search));
}

function renderLineups() {
  const generation = ++renderGeneration;
  const lineups = visibleLineups();
  const groups = visibleInstantGroups();

  if (state.selectedInstantSpot && !groups.some((g) => groupKey(g) === state.selectedInstantSpot)) {
    state.selectedInstantSpot = null;
  }
  if (!state.selectedInstantSpot) {
    const selected = lineups.find((l) => l.id === state.selectedLineupId) || lineups[0] || null;
    state.selectedLineupId = selected ? selected.id : null;
  }

  const isGroupView = !!state.selectedInstantSpot;
  document.getElementById("browseMediaStage").classList.toggle("hidden", isGroupView);
  document.getElementById("instantMediaStage").classList.toggle("hidden", !isGroupView);
  document.getElementById("lineupDetail").classList.toggle("hidden", isGroupView);
  document.getElementById("instantGroupBar").classList.toggle("hidden", !isGroupView);
  // Actions standard (favori/éditer/supprimer) n'ont de sens que hors vue groupée —
  // "Éditer ce lineup" (groupe) est en plus conditionné à la sélection d'un spawn
  // capturé, voir renderInstantShotPreview.
  document.getElementById("btnToggleFavorite").classList.toggle("hidden", isGroupView);
  document.getElementById("btnEditLineup").classList.toggle("hidden", isGroupView);
  document.getElementById("btnDeleteLineup").classList.toggle("hidden", isGroupView);
  document.getElementById("btnOpenSpawnLineup").classList.add("hidden");
  // Défensif en plus du garde de génération ci-dessous : si un rendu précédent de
  // l'autre vue est resté visible par erreur, on le cache immédiatement.
  document.getElementById(isGroupView ? "radarInset" : "instantGroupRadarInset").classList.add("hidden");
  document.getElementById(isGroupView ? "zoomInset" : "instantGroupZoomInset").classList.add("hidden");

  if (isGroupView) {
    renderInstantGroupView(groups.find((g) => groupKey(g) === state.selectedInstantSpot), generation);
  } else {
    renderStandardDetail(lineups.find((l) => l.id === state.selectedLineupId) || null, generation);
  }

  const map = state.maps.find((m) => m.id === state.filters.mapId);
  document.getElementById("stripLabel").textContent =
    `Autres lineups — ${map ? map.displayName : ""} / ${state.filters.side || "Tous les camps"}`;

  const strip = document.getElementById("lineupStrip");
  strip.innerHTML = "";
  for (const l of lineups) {
    const chip = document.createElement("div");
    const checked = state.selectedIds.has(l.id);
    chip.className =
      "chip" +
      (!isGroupView && !state.selectionMode && l.id === state.selectedLineupId ? " active" : "") +
      ` ${sideClassName(l.side)}`;
    const checkbox = state.selectionMode ? `<input type="checkbox" class="chip-select" ${checked ? "checked" : ""}> ` : "";
    chip.innerHTML = `${checkbox}${l.spotName}<br><span class="muted">${grenadeIconBadge(l.grenadeType)}</span>`;
    if (state.selectionMode) {
      chip.classList.toggle("active", checked);
      chip.onclick = () => {
        if (state.selectedIds.has(l.id)) state.selectedIds.delete(l.id);
        else state.selectedIds.add(l.id);
        renderLineups();
      };
    } else {
      chip.onclick = () => {
        state.selectedInstantSpot = null;
        state.selectedLineupId = l.id;
        renderLineups();
      };
    }
    strip.appendChild(chip);
  }
  for (const g of groups) {
    const chip = document.createElement("div");
    chip.className =
      "chip" +
      (isGroupView && groupKey(g) === state.selectedInstantSpot ? " active" : "") +
      ` ${sideClassName(g.side)}`;
    chip.innerHTML =
      `${g.spotName}<br><span class="muted">${grenadeIconBadge(g.grenadeType)} — Instant · ${g.lineups.length}</span>`;
    chip.onclick = () => {
      state.selectedInstantSpot = groupKey(g);
      renderLineups();
    };
    strip.appendChild(chip);
  }

  updateSelectionButtons();

  if (!isGroupView) syncActiveLineup();

  // Le panneau de filtres est partagé avec le radar plein écran (voir index.html) —
  // un changement de filtre doit s'y refléter immédiatement sans fermer cette vue.
  if (!document.getElementById("view-radar-fullscreen").classList.contains("hidden")) {
    renderRadarFullscreenMarkers();
  }
}

function renderStandardDetail(selected, generation) {
  const detailSpotName = document.getElementById("detailSpotName");
  const detailNotes = document.getElementById("detailNotes");
  const detailThrowLabel = document.getElementById("detailThrowLabel");

  detailThrowLabel.classList.remove("side-ct", "side-t");
  if (selected) {
    detailSpotName.textContent = selected.spotName;
    detailNotes.textContent = selected.notes || "";
    if (selected.throwLabel) {
      const wp = getFirstWaypoint(selected);
      const clickIcon = wp?.clickType ? `<span class="option-icon">${mouseIconSvg(wp.clickType)}</span>` : "";
      detailThrowLabel.innerHTML = `${clickIcon}${selected.throwLabel}`;
      detailThrowLabel.classList.add(sideClassName(selected.side));
      detailThrowLabel.classList.remove("hidden");
    } else {
      detailThrowLabel.classList.add("hidden");
    }
  } else {
    detailSpotName.textContent = "Aucun lineup pour ces filtres";
    detailNotes.textContent = "";
    detailThrowLabel.classList.add("hidden");
  }

  updateFavoriteButton(selected);
  document.getElementById("btnToggleFavorite").disabled = !selected;
  document.getElementById("btnEditLineup").disabled = !selected;
  document.getElementById("btnDeleteLineup").disabled = !selected;

  const map = state.maps.find((m) => m.id === state.filters.mapId);
  updateBrowseRadar(map, selected, generation);
  updateDetailScreenshot(selected, generation);
}

// --- Vue groupée "instant smoke" ---
//
// Cliquer un point du radar sélectionne juste le spawn à afficher en grand —
// ça ne quitte jamais le groupe. Pour éditer/favoriser/supprimer un lineup
// précis, un bouton dédié ("Éditer ce lineup") bascule vers la vue standard.

let instantGroupEntries = []; // [{ spawn, lineup|null }], un par spawn de la carte/side
let instantGroupSelectedSpawnId = null;

// --- Synchronisation du lineup "actif" vers Python (touche F6, voir main.py) ---
//
// F6 est un hotkey global déclenché pendant que CS2 a le focus (voir CLAUDE.md :
// clavier, pas clic) — Python ne peut donc pas lire state.selectedLineupId
// directement, il faut lui pousser la sélection courante à chaque changement.

let lastSyncedLineupId; // undefined au départ, force la première synchronisation

function currentActiveLineupId() {
  if (state.selectedInstantSpot) {
    const entry = instantGroupEntries.find((e) => e.spawn.id === instantGroupSelectedSpawnId);
    return entry?.lineup?.id ?? null;
  }
  return state.selectedLineupId;
}

function syncActiveLineup() {
  // set_active_lineup n'existe que sur l'Api complète (utilisé par F6, un hotkey
  // global absent du build consultation-only, voir main_consultation.py).
  if (state.mode !== "full") return;
  const id = currentActiveLineupId();
  if (id === lastSyncedLineupId) return;
  lastSyncedLineupId = id;
  api().set_active_lineup(id);
}

async function renderInstantGroupView(group, generation) {
  if (!group) return;

  document.getElementById("instantGroupTitle").textContent = group.spotName;
  const groupBar = document.getElementById("instantGroupBar");
  groupBar.classList.remove("side-ct", "side-t");
  groupBar.classList.add(sideClassName(group.side));

  const map = state.maps.find((m) => m.id === state.filters.mapId);
  const radarInset = document.getElementById("instantGroupRadarInset");
  const wrap = document.getElementById("instantGroupRadarWrap");
  const img = document.getElementById("instantGroupRadarImg");

  const spawns = map ? await api().get_spawnpoints(map.id, group.side) : [];
  if (generation !== renderGeneration) return; // un rendu plus récent a démarré entre-temps
  const lineupBySpawnId = new Map(group.lineups.filter((l) => l.spawnPoint).map((l) => [l.spawnPoint, l]));
  instantGroupEntries = spawns
    .map((spawn) => ({ spawn, lineup: lineupBySpawnId.get(spawn.id) || null }))
    .sort((a, b) => a.spawn.index - b.spawn.index);

  const doneCount = instantGroupEntries.filter((e) => e.lineup).length;
  document.getElementById("instantGroupSubtitle").innerHTML =
    `${grenadeIconSvg(group.grenadeType)} — ${doneCount}/${instantGroupEntries.length} spawn${instantGroupEntries.length > 1 ? "s" : ""} capturés`;

  if (!instantGroupEntries.some((e) => e.spawn.id === instantGroupSelectedSpawnId)) {
    instantGroupSelectedSpawnId = (instantGroupEntries.find((e) => e.lineup) || instantGroupEntries[0])?.spawn.id ?? null;
  }
  syncActiveLineup();

  if (!hasRadarCalibration(map) || instantGroupEntries.length === 0) {
    radarInset.classList.add("hidden");
    wrap.querySelectorAll(".instant-marker").forEach((el) => el.remove());
    img.removeAttribute("src");
  } else {
    await setRadarImageSrc(img, map.radarImageRef);
    if (generation !== renderGeneration) return; // idem
    radarInset.classList.remove("hidden");
    const points = instantGroupEntries.map((e) => {
      const { leftPct, topPct } = worldToRadarPercent(map, e.spawn.position.x, e.spawn.position.y);
      return {
        leftPct,
        topPct,
        label: String(e.spawn.index),
        done: !!e.lineup,
        selected: e.spawn.id === instantGroupSelectedSpawnId,
        side: group.side,
        onClick: () => selectSpawnInGroup(e.spawn.id),
      };
    });
    renderSpawnMarkers(wrap, points);
  }

  await renderInstantShotPreview(generation);
}

async function selectSpawnInGroup(spawnId) {
  instantGroupSelectedSpawnId = spawnId;
  syncActiveLineup();
  document.querySelectorAll("#instantGroupRadarWrap .instant-marker").forEach((el, i) => {
    el.classList.toggle("selected", instantGroupEntries[i]?.spawn.id === spawnId);
  });
  await renderInstantShotPreview(renderGeneration);
}

async function renderInstantShotPreview(generation) {
  const entry = instantGroupEntries.find((e) => e.spawn.id === instantGroupSelectedSpawnId);
  const img = document.getElementById("instantGroupShotImg");
  const empty = document.getElementById("instantGroupShotEmpty");
  const label = document.getElementById("instantShotLabel");
  const zoomInset = document.getElementById("instantGroupZoomInset");
  const zoomImg = document.getElementById("instantGroupZoomImg");
  const editBtn = document.getElementById("btnOpenSpawnLineup");

  if (entry) {
    label.textContent = `Spawn ${entry.spawn.index}`;
    label.classList.remove("hidden");
  } else {
    label.classList.add("hidden");
  }

  const wp = entry?.lineup ? getFirstWaypoint(entry.lineup) : null;

  const throwLabel = document.getElementById("instantThrowLabel");
  throwLabel.classList.remove("side-ct", "side-t");
  if (entry?.lineup?.throwLabel) {
    const clickIcon = wp?.clickType ? `<span class="option-icon">${mouseIconSvg(wp.clickType)}</span>` : "";
    throwLabel.innerHTML = `${clickIcon}${entry.lineup.throwLabel}`;
    throwLabel.classList.add(sideClassName(entry.lineup.side));
    throwLabel.classList.remove("hidden");
  } else {
    throwLabel.classList.add("hidden");
  }
  const [dataUrl, zoomUrl] = await Promise.all([
    wp?.screenshotRef ? api().get_screenshot_detail_data_url(wp.screenshotRef) : null,
    wp?.screenshotZoomRef ? api().get_screenshot_data_url(wp.screenshotZoomRef) : null,
  ]);
  if (generation !== renderGeneration) return; // un rendu/clic plus récent a démarré entre-temps
  if (dataUrl) {
    img.src = dataUrl;
    img.classList.remove("hidden");
    empty.classList.add("hidden");
  } else {
    img.classList.add("hidden");
    img.removeAttribute("src");
    empty.textContent = entry?.lineup ? "Pas de screenshot." : "Pas encore capturé pour ce spawn.";
    empty.classList.remove("hidden");
  }

  if (zoomUrl) {
    zoomImg.src = zoomUrl;
    zoomInset.classList.remove("hidden");
  } else {
    zoomImg.removeAttribute("src");
    zoomInset.classList.add("hidden");
  }

  editBtn.classList.toggle("hidden", !entry?.lineup);
  document.getElementById("btnDeleteSpawnLineup").classList.toggle("hidden", !entry?.lineup);
}

function openSelectedSpawnLineup() {
  const entry = instantGroupEntries.find((e) => e.spawn.id === instantGroupSelectedSpawnId);
  if (!entry?.lineup) return;
  openEditLineupView(entry.lineup);
}

async function deleteSpawnLineup() {
  const entry = instantGroupEntries.find((e) => e.spawn.id === instantGroupSelectedSpawnId);
  if (!entry?.lineup) return;
  if (!confirm(`Supprimer le lineup capturé pour le spawn ${entry.spawn.index} ?`)) return;
  await api().delete_lineup(entry.lineup.id);
  await refreshLineups();
}

// --- Actions sur le lineup sélectionné (favori / édition / suppression) ---

function selectedLineup() {
  return visibleLineups().find((l) => l.id === state.selectedLineupId) || null;
}

function updateFavoriteButton(lineup) {
  const btn = document.getElementById("btnToggleFavorite");
  const isFavorite = !!(lineup && lineup.favorite);
  btn.innerHTML = TOOLBAR_ICONS[isFavorite ? "starFilled" : "star"];
  btn.classList.toggle("active", isFavorite);
}

async function toggleFavorite() {
  const selected = selectedLineup();
  if (!selected) return;
  await api().toggle_favorite(selected.id);
  await refreshLineups();
}

// Réutilise le formulaire de création complet ("view-create") en mode édition :
// pré-remplit tous les champs depuis le lineup sélectionné, la sauvegarde met à
// jour ce lineup au lieu d'en créer un nouveau (voir armCapture/saveCapture).
async function openEditLineupView(lineup) {
  if (state.mode === "consultation") return; // voir openCreateView
  lineup = lineup || selectedLineup();
  if (!lineup) return;
  editingLineupId = lineup.id;

  document.getElementById("view-browse").classList.add("hidden");
  document.getElementById("view-create").classList.remove("hidden");
  document.getElementById("lineupPanelWrap").classList.add("hidden");
  document.getElementById("createViewTitle").textContent = "Éditer lineup";

  document.getElementById("form-mapId").value = lineup.mapId;
  setFormSide(lineup.side);
  setGrenadeTypeValue(lineup.grenadeType);
  document.getElementById("form-category").value = lineup.category;
  document.getElementById("form-spotName").value = lineup.spotName;
  document.getElementById("form-notes").value = lineup.notes || "";
  const wp = getFirstWaypoint(lineup);
  document.getElementById("form-movement").value = wp ? wp.movement : "stand";
  setClickTypeValue(wp && wp.clickType ? wp.clickType : "left");
  document.getElementById("form-crouch").checked = wp ? wp.crouch : false;

  await api().start_edit_capture(lineup.id);

  captureHasWaypoint = !!wp;
  updateSaveButtonState();
  document.getElementById("captureStatusLine").textContent = wp
    ? "Point existant conservé — vise puis F9 en jeu pour le recapturer si besoin."
    : "Aucun point capturé — vise puis F9 en jeu pour capturer.";
  await updateCaptureScreenshot(wp ? wp.screenshotRef : null);

  toggleInstantPanel();
  if (lineup.category === "instant") {
    await loadInstantSpawnPanel(); // remet instantSelectedSpawnId à null, réaffecté ci-dessous
    instantSelectedSpawnId = lineup.spawnPoint;
    document.getElementById("btnTeleportSpawn").disabled = !instantSelectedSpawnId;
    renderInstantPickerMarkers();
  }
  fitCreateRadarSquares();
}

async function deleteLineup() {
  const selected = selectedLineup();
  if (!selected) return;
  if (!confirm(`Supprimer le lineup "${selected.spotName}" ?`)) return;
  await api().delete_lineup(selected.id);
  await refreshLineups();
}

async function deleteInstantGroup() {
  const group = visibleInstantGroups().find((g) => groupKey(g) === state.selectedInstantSpot);
  if (!group) return;
  if (!confirm(`Supprimer tout le groupe "${group.spotName}" (${group.lineups.length} lineup(s) capturé(s)) ? Cette action est irréversible.`)) return;
  await api().delete_instant_group(state.filters.mapId, group.side, group.spotName);
  state.selectedInstantSpot = null;
  await refreshLineups();
}

// --- Sélection multiple + import/export (voir CLAUDE.md, format .zip) ---

function toggleSelectionMode() {
  state.selectionMode = !state.selectionMode;
  if (!state.selectionMode) state.selectedIds.clear();
  const btn = document.getElementById("btnSelectionMode");
  btn.innerHTML = TOOLBAR_ICONS[state.selectionMode ? "close" : "select"];
  btn.classList.toggle("active", state.selectionMode);
  renderLineups();
}

function updateSelectionButtons() {
  const count = state.selectedIds.size;
  const showSelectionButtons = state.selectionMode && count > 0;
  document.getElementById("btnExportSelection").classList.toggle("hidden", !showSelectionButtons);
  document.getElementById("btnDeleteSelection").classList.toggle("hidden", !showSelectionButtons);
  document.getElementById("exportSelectionCount").textContent = count || "";
  document.getElementById("deleteSelectionCount").textContent = count || "";
}

async function exportSelection() {
  const result = await api().export_lineups([...state.selectedIds]);
  if (result.status === "ok") {
    toggleSelectionMode();
  } else if (result.status !== "cancelled") {
    alert(result.message || "Échec de l'export.");
  }
}

async function exportLibrary() {
  const result = await api().export_library();
  if (result.status !== "ok" && result.status !== "cancelled") {
    alert(result.message || "Échec de l'export.");
  }
}

async function importLineups() {
  const result = await api().import_lineups();
  if (result.status === "cancelled") return;
  if (result.status !== "ok") {
    alert(result.message || "Échec de l'import.");
    return;
  }
  await refreshLineups();
  const warningsText = result.warnings.length ? `\n${result.warnings.length} avertissement(s).` : "";
  alert(`${result.imported} lineup(s) importé(s), ${result.skipped} ignoré(s).${warningsText}`);
}

async function deleteSelection() {
  const count = state.selectedIds.size;
  if (!count) return;
  if (!confirm(`Supprimer définitivement ${count} lineup(s) ? Cette action est irréversible.`)) return;
  await api().delete_lineups([...state.selectedIds]);
  toggleSelectionMode();
  await refreshLineups();
}

function getFirstWaypoint(lineup) {
  return lineup?.waypoints?.[0] || null;
}

async function updateBrowseRadar(map, selectedLineup, generation) {
  const inset = document.getElementById("radarInset");
  const img = document.getElementById("radarImg");
  const marker = document.getElementById("radarMarker");
  const startWp = getFirstWaypoint(selectedLineup);

  if (!hasRadarCalibration(map)) {
    inset.classList.add("hidden");
    return;
  }

  await setRadarImageSrc(img, map.radarImageRef);
  if (generation !== renderGeneration) return; // un rendu plus récent a démarré entre-temps
  inset.classList.remove("hidden");
  marker.classList.remove("side-ct", "side-t");
  if (startWp) {
    const { leftPct, topPct } = worldToRadarPercent(map, startWp.position.x, startWp.position.y);
    setRadarMarker(marker, leftPct, topPct);
    marker.classList.add(sideClassName(selectedLineup.side));
  } else {
    marker.classList.add("hidden");
  }
}

// --- Vue "Radar plein écran" : toutes les positions standards filtrées d'un coup ---
//
// Les lineups instant n'y apparaissent jamais — plusieurs spawns très proches pour
// un même spot les ferait se marcher dessus, et ils ont déjà leur propre flux dédié
// (regroupement par spot + radar zoomé sur le cluster, voir renderInstantGroupView).

// Même liste que le panneau latéral (catégorie standard uniquement) — state.lineups
// est déjà filtré par carte/camp/type de grenade côté backend (voir refreshLineups) ;
// seul le texte de recherche doit être ré-appliqué ici, comme dans visibleLineups().
function lineupsForRadar() {
  return standardLineups().filter(
    (l) => !state.search || l.spotName.toLowerCase().includes(state.search)
  );
}

function openRadarFullscreen() {
  document.getElementById("view-browse").classList.add("hidden");
  document.getElementById("view-radar-fullscreen").classList.remove("hidden");
  // Le panneau de filtres est partagé (pas dupliqué) — on le déplace dans cette vue
  // pour qu'il pousse le radar plutôt que de flotter par-dessus (voir index.html).
  document.querySelector(".radar-fullscreen-layout").appendChild(document.getElementById("lineupPanelWrap"));
  fitRadarFullscreenSquare();
  renderRadarFullscreenMarkers();
}

function closeRadarFullscreen() {
  closeRadarClusterPopover();
  document.getElementById("view-radar-fullscreen").classList.add("hidden");
  document.getElementById("view-browse").classList.remove("hidden");
  // Ramène le panneau de filtres dans la vue de consultation (voir openRadarFullscreen).
  document.querySelector(".browse-layout").appendChild(document.getElementById("lineupPanelWrap"));
}

// clusterByProximity : logic.js (regroupement glouton par proximité visuelle en px).

async function renderRadarFullscreenMarkers() {
  const generation = ++renderGeneration;
  const map = state.maps.find((m) => m.id === state.filters.mapId);
  const img = document.getElementById("radarFullscreenImg");
  const wrap = document.getElementById("radarFullscreenWrap");
  const empty = document.getElementById("radarFullscreenEmpty");

  document.getElementById("radarFullscreenTitle").textContent = map ? map.displayName : "";

  wrap.querySelectorAll(".radar-marker-icon").forEach((el) => el.remove());
  closeRadarClusterPopover();

  if (!hasRadarCalibration(map)) {
    img.removeAttribute("src");
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  await setRadarImageSrc(img, map.radarImageRef);
  if (generation !== renderGeneration) return; // un rendu plus récent a démarré entre-temps

  // Le seuil de clustering se calcule en pixels réels — .radar-wrap est déjà à sa
  // taille finale grâce à fitRadarFullscreenSquare(), appelée avant ce rendu.
  const size = wrap.clientWidth || 1;
  const clusterThresholdPx = 28;

  // Regroupement par PROXIMITÉ seule, tous types de grenade confondus — grouper par
  // type d'abord aurait laissé deux lineups de types différents à la même position
  // se superposer pile l'un sur l'autre (bug signalé : une flash totalement cachée
  // derrière une smoke). L'icône affichée est celle du premier lineup du cluster ;
  // le popover (ci-dessous) précise le type de chaque entrée pour lever l'ambiguïté.
  const points = [];
  for (const l of lineupsForRadar()) {
    const wp = getFirstWaypoint(l);
    if (!wp) continue;
    const { leftPct, topPct } = worldToRadarPercent(map, wp.position.x, wp.position.y);
    points.push({
      lineup: l,
      leftPct,
      topPct,
      leftPx: (leftPct / 100) * size,
      topPx: (topPct / 100) * size,
    });
  }

  for (const cluster of clusterByProximity(points, clusterThresholdPx)) {
    const leftPct = (cluster.leftPx / size) * 100;
    const topPct = (cluster.topPx / size) * 100;
    const btn = document.createElement("button");
    const sameSide = cluster.items.every((l) => l.side === cluster.items[0].side);
    btn.className = "radar-marker-icon" + (sameSide ? ` ${sideClassName(cluster.items[0].side)}` : "");
    btn.style.left = `${leftPct}%`;
    btn.style.top = `${topPct}%`;
    btn.innerHTML = clusterIconSvg(cluster.items.map((l) => l.grenadeType));

    if (cluster.items.length === 1) {
      const lineup = cluster.items[0];
      btn.onclick = () => selectLineupFromRadar(lineup.id);
      // Popover identique à celui d'un groupe (pas de `title` natif : son délai
      // d'apparition du navigateur rendait la description perceptiblement lente).
      btn.onmouseenter = () => openRadarClusterPopover([lineup], btn, { interactive: false });
      btn.onmouseleave = () => closeRadarClusterPopover();
    } else {
      btn.title = `${cluster.items.length} lineups`;
      const badge = document.createElement("span");
      badge.className = "marker-badge";
      badge.textContent = String(cluster.items.length);
      btn.appendChild(badge);
      btn.onclick = (evt) => {
        evt.stopPropagation();
        openRadarClusterPopover(cluster.items, btn);
      };
    }
    wrap.appendChild(btn);
  }
}

function selectLineupFromRadar(lineupId) {
  state.selectedInstantSpot = null;
  state.selectedLineupId = lineupId;
  closeRadarFullscreen();
  renderLineups();
}

let radarClusterPopoverEl = null;
let radarClusterOutsideClickHandler = null;

function closeRadarClusterPopover() {
  if (radarClusterPopoverEl) {
    radarClusterPopoverEl.remove();
    radarClusterPopoverEl = null;
  }
  if (radarClusterOutsideClickHandler) {
    document.removeEventListener("click", radarClusterOutsideClickHandler);
    radarClusterOutsideClickHandler = null;
  }
}

// Positionne le popover en pixels, ancré au marqueur mais toujours contenu dans le
// radar (`.radar-wrap` a overflow:hidden — un positionnement en %/transform naïf le
// fait dépasser et se faire couper net près d'un bord, voir bug signalé).
function positionClusterPopover(popover, anchorEl, wrap) {
  const margin = 16;
  const wrapRect = wrap.getBoundingClientRect();
  const anchorRect = anchorEl.getBoundingClientRect();
  const popRect = popover.getBoundingClientRect();

  let left = anchorRect.right - wrapRect.left + margin;
  if (wrapRect.left + left + popRect.width > wrapRect.right) {
    // Ne rentre pas à droite de l'ancre → on bascule à gauche.
    left = anchorRect.left - wrapRect.left - margin - popRect.width;
  }
  left = Math.max(4, Math.min(left, wrapRect.width - popRect.width - 4));

  let top = anchorRect.top - wrapRect.top + anchorRect.height / 2 - popRect.height / 2;
  top = Math.max(4, Math.min(top, wrapRect.height - popRect.height - 4));

  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
}

// `interactive: false` (survol d'un marqueur seul) saute l'écouteur de clic
// extérieur : le popover se referme déjà via onmouseleave côté appelant, un
// listener en plus ne ferait que le fermer en double sans utilité.
function openRadarClusterPopover(lineups, anchorEl, { interactive = true } = {}) {
  closeRadarClusterPopover();

  const wrap = document.getElementById("radarFullscreenWrap");
  const popover = document.createElement("div");
  popover.className = "radar-cluster-popover";

  for (const l of lineups) {
    const btn = document.createElement("button");
    // Le type de grenade n'est pas répété en texte ici : l'icône de l'entrée (propre
    // à chaque lineup, contrairement à celle du marqueur qui n'en montre qu'une pour
    // tout le cluster) le montre déjà.
    btn.innerHTML =
      `<span class="popover-entry-icon">${grenadeIconSvg(l.grenadeType)}</span>` +
      `<span>${l.spotName}${l.throwLabel ? `<br><span class="muted">${l.throwLabel}</span>` : ""}</span>`;
    btn.onclick = () => selectLineupFromRadar(l.id);
    popover.appendChild(btn);
  }

  wrap.appendChild(popover);
  radarClusterPopoverEl = popover;
  positionClusterPopover(popover, anchorEl, wrap);

  if (!interactive) return;

  // Écouteur ajouté après coup (pas dans le même tick que le clic qui ouvre le
  // popover, sinon ce même clic — déjà stoppé par evt.stopPropagation() sur le
  // marqueur — le refermerait immédiatement).
  setTimeout(() => {
    radarClusterOutsideClickHandler = (evt) => {
      if (!popover.contains(evt.target)) closeRadarClusterPopover();
    };
    document.addEventListener("click", radarClusterOutsideClickHandler);
  }, 0);
}

// Même principe que fitCreateRadarSquares() (voir plus bas) : caler le radar
// au plus grand carré qui rentre dans l'espace vertical restant.
function fitRadarFullscreenSquare() {
  const slot = document.querySelector("#view-radar-fullscreen .radar-slot");
  const wrap = document.getElementById("radarFullscreenWrap");
  if (!slot || !wrap) return;
  const size = Math.max(0, Math.min(slot.clientWidth, slot.clientHeight));
  if (size > 0) {
    wrap.style.width = `${size}px`;
    wrap.style.height = `${size}px`;
  } else {
    wrap.style.width = "";
    wrap.style.height = "";
  }
}

window.addEventListener("resize", fitRadarFullscreenSquare);

async function updateDetailScreenshot(selectedLineup, generation) {
  const img = document.getElementById("detailScreenshotImg");
  const fallback = document.getElementById("detailScreenshotFallback");
  const caption = document.getElementById("detailScreenshotCaption");
  const zoomInset = document.getElementById("zoomInset");
  const zoomImg = document.getElementById("detailZoomImg");
  const startWp = getFirstWaypoint(selectedLineup);

  const [dataUrl, zoomUrl] = await Promise.all([
    startWp?.screenshotRef ? api().get_screenshot_detail_data_url(startWp.screenshotRef) : null,
    // screenshotZoomRef : recadrage à 200% autour du viseur (voir capture.py) — utile
    // pour vérifier précisément l'alignement de la visée, en plus du screenshot complet.
    // Incrustation entièrement masquée (pas de case vide) si la donnée n'existe pas.
    startWp?.screenshotZoomRef ? api().get_screenshot_data_url(startWp.screenshotZoomRef) : null,
  ]);
  if (generation !== renderGeneration) return; // idem
  if (dataUrl) {
    img.src = dataUrl;
    img.classList.remove("hidden");
    fallback.classList.add("hidden");
  } else {
    img.classList.add("hidden");
    img.removeAttribute("src");
    fallback.classList.remove("hidden");
  }

  if (zoomUrl) {
    zoomImg.src = zoomUrl;
    zoomInset.classList.remove("hidden");
  } else {
    zoomImg.removeAttribute("src");
    zoomInset.classList.add("hidden");
  }

  if (startWp?.description) {
    caption.textContent = startWp.description;
    caption.classList.remove("hidden");
  } else {
    caption.textContent = "";
    caption.classList.add("hidden");
  }
}

// --- Vue "Nouveau lineup" ---

function openCreateView() {
  // Garde défensive — le bouton qui déclenche ceci est masqué en mode
  // consultation (voir style.css .consultation-mode), ce return couvre le cas
  // où il resterait atteignable autrement.
  if (state.mode === "consultation") return;
  document.getElementById("view-browse").classList.add("hidden");
  document.getElementById("view-create").classList.remove("hidden");
  // Le panneau de filtres flotte par-dessus consultation/radar, mais pas la création
  // (formulaire, pas de liste à filtrer) — voir index.html.
  document.getElementById("lineupPanelWrap").classList.add("hidden");
  editingLineupId = null;
  document.getElementById("createViewTitle").textContent = "Nouveau lineup";
  if (state.filters.mapId) document.getElementById("form-mapId").value = state.filters.mapId;
  setFormSide(state.filters.side || "CT");
  document.getElementById("form-crouch").checked = false;
  document.getElementById("btnSaveCapture").disabled = true;
  updateCaptureScreenshot(null);
  toggleInstantPanel();
  armCapture();
  fitCreateRadarSquares();
}

// Taille du radar de #view-create imposée en pixels plutôt qu'en vh : un vh
// devine une proportion de l'écran sans savoir combien le reste du formulaire
// occupe réellement. #instantSpawnPanel est étiré en hauteur par .capture-media
// (flex row, stretch par défaut) — on lit cette hauteur déjà connue puis on
// fixe la LARGEUR du panneau au même nombre de pixels (carré) : le panneau ne
// prend ainsi que la largeur nécessaire, le screenshot (flex:1) récupère le
// reste. Recalculé au redimensionnement (voir listener "resize" plus bas).
function fitCreateRadarSquares() {
  document.querySelectorAll("#view-create .radar-slot").forEach((slot) => {
    const wrap = slot.querySelector(".radar-wrap");
    const panel = slot.parentElement; // #instantSpawnPanel
    if (!wrap || !panel) return;
    const size = Math.max(0, panel.clientHeight);
    if (size > 0) {
      panel.style.width = `${size}px`;
      wrap.style.width = `${size}px`;
      wrap.style.height = `${size}px`;
    } else {
      panel.style.width = "";
      wrap.style.width = "";
      wrap.style.height = "";
    }
  });
}

window.addEventListener("resize", fitCreateRadarSquares);

// --- Instant smoke : picker de spawn (radar zoomé, boutons cliquables) ---

let instantSpawnsCache = [];
let instantDoneIdsCache = new Set();
let instantSelectedSpawnId = null;

function toggleInstantPanel() {
  const isInstant = document.getElementById("form-category").value === "instant";
  document.getElementById("instantSpawnPanel").classList.toggle("hidden", !isInstant);
  document.getElementById("instantPickerStatusLine").classList.toggle("hidden", !isInstant);
  document.getElementById("teleportActionsRow").classList.toggle("hidden", !isInstant);
  if (isInstant) loadInstantSpawnPanel();
  fitCreateRadarSquares();
}

async function loadInstantSpawnPanel() {
  instantSelectedSpawnId = null;
  document.getElementById("btnTeleportSpawn").disabled = true;
  document.getElementById("instantPickerStatusLine").textContent = "Sélectionnez un spawn puis téléportez-vous.";

  const mapId = document.getElementById("form-mapId").value;
  const side = document.getElementById("form-side").value;
  const map = state.maps.find((m) => m.id === mapId);
  const wrap = document.getElementById("instantPickerWrap");
  const img = document.getElementById("instantPickerImg");

  if (!hasRadarCalibration(map)) {
    wrap.querySelectorAll(".instant-marker").forEach((el) => el.remove());
    img.removeAttribute("src");
    instantSpawnsCache = [];
    return;
  }
  await setRadarImageSrc(img, map.radarImageRef);

  instantSpawnsCache = await api().get_spawnpoints(mapId, side);

  const spotName = document.getElementById("form-spotName").value.trim();
  const existing = spotName ? await api().get_lineups(mapId, side, null, "instant") : [];
  instantDoneIdsCache = new Set(
    existing.filter((l) => l.spotName === spotName).map((l) => l.spawnPoint).filter(Boolean)
  );

  renderInstantPickerMarkers();
}

function renderInstantPickerMarkers() {
  const map = state.maps.find((m) => m.id === document.getElementById("form-mapId").value);
  if (!hasRadarCalibration(map)) return;

  const wrap = document.getElementById("instantPickerWrap");
  const side = document.getElementById("form-side").value;
  const points = instantSpawnsCache.map((sp) => {
    const { leftPct, topPct } = worldToRadarPercent(map, sp.position.x, sp.position.y);
    return {
      leftPct,
      topPct,
      label: String(sp.index),
      done: instantDoneIdsCache.has(sp.id),
      selected: sp.id === instantSelectedSpawnId,
      side,
      onClick: () => selectInstantSpawn(sp.id),
    };
  });
  renderSpawnMarkers(wrap, points);
}

function selectInstantSpawn(spawnId) {
  instantSelectedSpawnId = spawnId;
  document.getElementById("btnTeleportSpawn").disabled = false;
  renderInstantPickerMarkers();
  armCapture();
}

async function teleportToSelectedSpawn() {
  if (state.mode === "consultation") return; // voir openCreateView
  if (!instantSelectedSpawnId) return;
  const fixBtn = document.getElementById("btnFixMapMismatch");
  fixBtn.classList.add("hidden");
  document.getElementById("instantPickerStatusLine").textContent = "Téléportation...";
  const result = await api().teleport_to_spawn(instantSelectedSpawnId);
  document.getElementById("instantPickerStatusLine").textContent =
    result.status === "ok"
      ? "Téléporté — vise puis F9 pour capturer."
      : result.message || "Erreur de téléportation.";

  if (result.status === "error" && result.expectedMapId) {
    fixBtn.classList.remove("hidden");
    fixBtn.onclick = () => fixMapMismatch(result.expectedMapId);
  }
}

async function fixMapMismatch(mapId) {
  document.getElementById("btnFixMapMismatch").classList.add("hidden");
  document.getElementById("instantPickerStatusLine").textContent = "Chargement de la map...";
  const result = await api().change_server_map(mapId);
  document.getElementById("instantPickerStatusLine").textContent =
    result.status === "ok"
      ? "Chargement de la map... réessaie la téléportation dans quelques secondes."
      : result.message || "Erreur lors du changement de map.";
}

async function closeCreateView() {
  if (state.mode === "consultation") return; // voir openCreateView
  await api().cancel_capture();
  editingLineupId = null;
  document.getElementById("view-create").classList.add("hidden");
  document.getElementById("view-browse").classList.remove("hidden");
  document.getElementById("lineupPanelWrap").classList.remove("hidden");
  await refreshLineups();
}

// Le bouton "Sauvegarder" ne doit s'activer que si un waypoint a été capturé (F9)
// ET qu'un nom de spot est renseigné (requis par save_capture — voir main.py) —
// sans quoi le lineup se sauvegarde avec spotName vide, ce qui casse le regroupement
// par spot (bibliothèque standard) et le marquage "spawn capturé" (instant smoke).
let captureHasWaypoint = false;

function updateSaveButtonState() {
  const spotName = document.getElementById("form-spotName").value.trim();
  document.getElementById("btnSaveCapture").disabled = !spotName || !captureHasWaypoint;
}

// Arme la capture (F9) avec les valeurs actuelles du formulaire — pas de bouton
// "Démarrer" : aucune info supplémentaire n'est nécessaire pour armer, donc c'est
// fait automatiquement à l'ouverture de la vue et à chaque changement de champ
// pertinent (voir les écouteurs "change"/"input" dans initInner).
async function armCapture() {
  if (state.mode === "consultation") return; // voir openCreateView
  const category = document.getElementById("form-category").value;
  const mapId = document.getElementById("form-mapId").value;
  const side = document.getElementById("form-side").value;
  const grenadeType = document.getElementById("form-grenadeType").value;
  const spotName = document.getElementById("form-spotName").value.trim();
  const notes = document.getElementById("form-notes").value;
  const movement = document.getElementById("form-movement").value;
  const clickType = document.getElementById("form-clickType").value;
  const crouch = document.getElementById("form-crouch").checked;
  const spawnPoint = category === "instant" ? instantSelectedSpawnId : null;

  if (editingLineupId) {
    // En édition, changer un champ ne doit pas systématiquement invalider le
    // waypoint capturé — seul un changement de carte/camp/spawn le fait (la
    // position n'a alors plus de sens), voir CaptureSession.update_fields dans
    // capture.py. Cas particulier "instant" : si le spawn choisi est déjà capturé
    // par un AUTRE lineup du même groupe, l'édition bascule sur ce lineup-là
    // (voir Api.update_capture_fields côté Python) — il faut alors resynchroniser
    // tout le formulaire avec ses propres valeurs plutôt que la sélection actuelle.
    const draft = await api().update_capture_fields(
      mapId, side, grenadeType, spotName, notes, movement, clickType, crouch, category, spawnPoint
    );

    if (draft.editingLineupId !== editingLineupId) {
      editingLineupId = draft.editingLineupId;
      setGrenadeTypeValue(draft.grenadeType);
      document.getElementById("form-spotName").value = draft.spotName;
      document.getElementById("form-notes").value = draft.notes || "";
      document.getElementById("form-movement").value = draft.movement;
      setClickTypeValue(draft.clickType);
      document.getElementById("form-crouch").checked = draft.crouch;
      instantSelectedSpawnId = draft.spawnPoint;
      document.getElementById("btnTeleportSpawn").disabled = !instantSelectedSpawnId;
      renderInstantPickerMarkers();
    }

    captureHasWaypoint = !!draft.waypoint;
    updateSaveButtonState();
    document.getElementById("captureStatusLine").textContent = draft.waypoint
      ? "Point conservé — vise puis F9 en jeu pour le recapturer si besoin."
      : "Carte/camp/spawn changé : le point existant n'est plus valide — vise puis F9 pour capturer.";
    await updateCaptureScreenshot(draft.waypoint ? draft.waypoint.screenshotRef : null);
    return;
  }

  // start_capture est appelé à l'ouverture ET à chaque champ modifié (pas de bouton
  // "Démarrer" séparé) — il conserve le waypoint déjà capturé côté serveur sauf si
  // la carte/le camp/le spawn change (voir CaptureSession.start dans capture.py),
  // donc on resynchronise l'état local sur le draft retourné plutôt que de tout
  // invalider par défaut.
  const draft = await api().start_capture(mapId, side, grenadeType, spotName, notes, movement, clickType, crouch, category, spawnPoint);
  captureHasWaypoint = !!draft.waypoint;
  updateSaveButtonState();
  document.getElementById("captureStatusLine").textContent = draft.waypoint
    ? `Point conservé — vise puis F9 en jeu pour le recapturer si besoin.`
    : "Prêt — vise puis appuie sur F9 en jeu pour capturer.";
  await updateCaptureScreenshot(draft.waypoint ? draft.waypoint.screenshotRef : null);
}

// Appelée par Python (evaluate_js) après un appui sur F9 en jeu
async function onCaptureUpdated() {
  const draft = await api().get_capture_draft();
  if (!draft) return;
  if (draft.waypoint) {
    captureHasWaypoint = true;
    const spotName = document.getElementById("form-spotName").value.trim();
    document.getElementById("captureStatusLine").textContent = spotName
      ? `Capturé : x=${draft.waypoint.position.x.toFixed(1)} y=${draft.waypoint.position.y.toFixed(1)} z=${draft.waypoint.position.z.toFixed(1)} — F6 pour tester.`
      : `Capturé, mais le nom du spot est requis avant de sauvegarder.`;
    updateSaveButtonState();
    await updateCaptureScreenshot(draft.waypoint.screenshotRef);
  }
}

async function updateCaptureScreenshot(screenshotRef) {
  const img = document.getElementById("captureScreenshotImg");
  if (!screenshotRef) {
    img.classList.add("hidden");
    img.removeAttribute("src");
    return;
  }
  const dataUrl = await api().get_screenshot_data_url(screenshotRef);
  if (dataUrl) {
    img.src = dataUrl;
    img.classList.remove("hidden");
  } else {
    img.classList.add("hidden");
    img.removeAttribute("src");
  }
}
window.onCaptureUpdated = onCaptureUpdated;

async function saveCapture() {
  if (state.mode === "consultation") return; // voir openCreateView
  const result = await api().save_capture();
  if (result.status !== "saved") {
    document.getElementById("captureStatusLine").textContent = result.message || "Erreur lors de la sauvegarde.";
    return;
  }

  if (!editingLineupId && document.getElementById("form-category").value === "instant") {
    // Reste dans la vue de création — répétition manuelle par spawn (voir plan) :
    // le spawn qui vient d'être sauvegardé apparaît "done" dans le picker, prêt
    // pour en choisir un autre sans ressaisir tout le formulaire.
    document.getElementById("btnSaveCapture").disabled = true;
    updateCaptureScreenshot(null);
    await loadInstantSpawnPanel();
    await armCapture();
    document.getElementById("captureStatusLine").textContent = "Spawn sauvegardé — choisissez le spawn suivant.";
    return;
  }

  document.getElementById("view-create").classList.add("hidden");
  document.getElementById("view-browse").classList.remove("hidden");
  document.getElementById("lineupPanelWrap").classList.remove("hidden");
  if (result.lineup.category === "instant") {
    state.selectedInstantSpot = `${result.lineup.side}::${result.lineup.spotName}`;
    state.selectedLineupId = null;
  } else {
    state.selectedInstantSpot = null;
    state.selectedLineupId = result.lineup.id;
  }
  editingLineupId = null;
  await refreshLineups();
}

async function toggleHud() {
  if (state.mode === "consultation") return; // voir openCreateView
  const btn = document.getElementById("btnToggleHud");
  const status = document.getElementById("hudToggleStatusLine");
  btn.disabled = true;
  const result = await api().toggle_hud();
  btn.disabled = false;
  status.classList.remove("hidden");

  if (result.status === "hidden") {
    btn.innerHTML = TOOLBAR_ICONS.eyeOff;
    btn.title = "Afficher le HUD";
    status.textContent = "HUD masqué — le délai avant que ce soit visible en jeu varie.";
  } else if (result.status === "shown") {
    btn.innerHTML = TOOLBAR_ICONS.eye;
    btn.title = "Masquer le HUD (test)";
    status.textContent = "HUD restauré.";
  } else {
    status.textContent = result.message || "Erreur.";
  }
}

let initStarted = false;
function initOnce() {
  if (initStarted) return;
  initStarted = true;
  init();
}

if (window.pywebview) {
  initOnce();
} else {
  window.addEventListener("pywebviewready", initOnce);
}
