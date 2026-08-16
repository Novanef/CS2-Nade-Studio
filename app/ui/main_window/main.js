const GRENADE_TYPES = ["smoke", "flash", "molotov", "he", "decoy"];
const GRENADE_LABELS = { smoke: "Smoke", flash: "Flash", molotov: "Molotov", he: "HE", decoy: "Decoy" };

const state = {
  maps: [],
  lineups: [],
  filters: { mapId: null, side: "CT", grenadeType: null },
  search: "",
  selectedLineupId: null,
  selectedInstantSpot: null,
};

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

function hasRadarCalibration(map) {
  return !!map && map.radarPosX != null && map.radarPosY != null && map.radarScale != null;
}

function worldToRadarPercent(map, x, y) {
  const px = (x - map.radarPosX) / map.radarScale;
  const py = (map.radarPosY - y) / map.radarScale;
  return { leftPct: (px / 1024) * 100, topPct: (py / 1024) * 100 };
}

function setRadarMarker(markerEl, leftPct, topPct) {
  markerEl.style.left = `${leftPct}%`;
  markerEl.style.top = `${topPct}%`;
  markerEl.classList.remove("hidden");
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

function applyZoomFrameToImage(img, frame) {
  const scale = 100 / frame.span;
  img.style.width = `${scale * 100}%`;
  img.style.height = `${scale * 100}%`;
  img.style.left = `${-frame.minX * scale}%`;
  img.style.top = `${-frame.minY * scale}%`;
}

function zoomedPercentX(pct, frame) {
  return (pct - frame.minX) * (100 / frame.span);
}

function zoomedPercentY(pct, frame) {
  return (pct - frame.minY) * (100 / frame.span);
}

// Rend un radar zoomé avec un marqueur numéroté par point (spawns) — réutilisé pour
// le picker de spawn en création et pour la vue groupée instant smoke en bibliothèque.
// `points` : [{ leftPct, topPct, label, done, selected, onClick }]
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
    el.className = "instant-marker" + (p.onClick ? "" : " static") + (p.done ? " done" : "") + (p.selected ? " selected" : "");
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

async function initInner() {
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
  });
  formMapSelect.addEventListener("change", () => {
    if (document.getElementById("form-category").value === "instant") loadInstantSpawnPanel();
    armCapture();
  });
  document.getElementById("form-side").addEventListener("change", () => {
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

  await refreshLineups();
}

function renderCategoryPills() {
  const container = document.getElementById("categoryPills");
  container.innerHTML = "";
  for (const gt of GRENADE_TYPES) {
    const btn = document.createElement("button");
    btn.className = "pill";
    btn.textContent = GRENADE_LABELS[gt];
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

// Regroupe les lineups "instant" par spotName — même clé de regroupement que
// documentée dans docs/structure-donnees-lineups.md (mapId/side déjà filtrés par
// get_lineups, donc regrouper par spotName suffit ici).
function instantGroups() {
  const byName = new Map();
  for (const l of state.lineups) {
    if (l.category !== "instant") continue;
    if (!byName.has(l.spotName)) byName.set(l.spotName, { spotName: l.spotName, grenadeType: l.grenadeType, lineups: [] });
    byName.get(l.spotName).lineups.push(l);
  }
  return [...byName.values()];
}

function visibleLineups() {
  const items = standardLineups();
  if (!state.search) return items;
  return items.filter((l) => l.spotName.toLowerCase().includes(state.search));
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

  if (state.selectedInstantSpot && !groups.some((g) => g.spotName === state.selectedInstantSpot)) {
    state.selectedInstantSpot = null;
  }
  if (!state.selectedInstantSpot) {
    const selected = lineups.find((l) => l.id === state.selectedLineupId) || lineups[0] || null;
    state.selectedLineupId = selected ? selected.id : null;
  }

  exitEditMode();

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
    renderInstantGroupView(groups.find((g) => g.spotName === state.selectedInstantSpot), generation);
  } else {
    renderStandardDetail(lineups.find((l) => l.id === state.selectedLineupId) || null, generation);
  }

  const map = state.maps.find((m) => m.id === state.filters.mapId);
  document.getElementById("stripLabel").textContent =
    `Autres lineups — ${map ? map.displayName : ""} / ${state.filters.side}`;

  const strip = document.getElementById("lineupStrip");
  strip.innerHTML = "";
  for (const l of lineups) {
    const chip = document.createElement("div");
    chip.className = "chip" + (!isGroupView && l.id === state.selectedLineupId ? " active" : "");
    chip.innerHTML = `${l.spotName}<br><span class="muted">${GRENADE_LABELS[l.grenadeType] || l.grenadeType}</span>`;
    chip.onclick = () => {
      state.selectedInstantSpot = null;
      state.selectedLineupId = l.id;
      renderLineups();
    };
    strip.appendChild(chip);
  }
  for (const g of groups) {
    const chip = document.createElement("div");
    chip.className = "chip" + (isGroupView && g.spotName === state.selectedInstantSpot ? " active" : "");
    chip.innerHTML =
      `${g.spotName}<br><span class="muted">${GRENADE_LABELS[g.grenadeType] || g.grenadeType} — Instant · ${g.lineups.length}</span>`;
    chip.onclick = () => {
      state.selectedInstantSpot = g.spotName;
      renderLineups();
    };
    strip.appendChild(chip);
  }

  if (!isGroupView) syncActiveLineup();
}

function renderStandardDetail(selected, generation) {
  const detailSpotName = document.getElementById("detailSpotName");
  const detailNotes = document.getElementById("detailNotes");
  const detailThrowLabel = document.getElementById("detailThrowLabel");

  if (selected) {
    detailSpotName.textContent = selected.spotName;
    detailNotes.textContent = selected.notes || "";
    if (selected.throwLabel) {
      detailThrowLabel.textContent = selected.throwLabel;
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
  const id = currentActiveLineupId();
  if (id === lastSyncedLineupId) return;
  lastSyncedLineupId = id;
  api().set_active_lineup(id);
}

async function renderInstantGroupView(group, generation) {
  if (!group) return;

  document.getElementById("instantGroupTitle").textContent = group.spotName;

  const map = state.maps.find((m) => m.id === state.filters.mapId);
  const radarInset = document.getElementById("instantGroupRadarInset");
  const wrap = document.getElementById("instantGroupRadarWrap");
  const img = document.getElementById("instantGroupRadarImg");

  const spawns = map ? await api().get_spawnpoints(map.id, state.filters.side) : [];
  if (generation !== renderGeneration) return; // un rendu plus récent a démarré entre-temps
  const lineupBySpawnId = new Map(group.lineups.filter((l) => l.spawnPoint).map((l) => [l.spawnPoint, l]));
  instantGroupEntries = spawns
    .map((spawn) => ({ spawn, lineup: lineupBySpawnId.get(spawn.id) || null }))
    .sort((a, b) => a.spawn.index - b.spawn.index);

  const doneCount = instantGroupEntries.filter((e) => e.lineup).length;
  document.getElementById("instantGroupSubtitle").textContent =
    `${GRENADE_LABELS[group.grenadeType] || group.grenadeType} — ${doneCount}/${instantGroupEntries.length} spawn${instantGroupEntries.length > 1 ? "s" : ""} capturés`;

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

  const throwLabel = document.getElementById("instantThrowLabel");
  if (entry?.lineup?.throwLabel) {
    throwLabel.textContent = entry.lineup.throwLabel;
    throwLabel.classList.remove("hidden");
  } else {
    throwLabel.classList.add("hidden");
  }

  const wp = entry?.lineup ? getFirstWaypoint(entry.lineup) : null;
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
}

function openSelectedSpawnLineup() {
  const entry = instantGroupEntries.find((e) => e.spawn.id === instantGroupSelectedSpawnId);
  if (!entry?.lineup) return;
  state.selectedInstantSpot = null;
  state.selectedLineupId = entry.lineup.id;
  renderLineups();
}

// --- Actions sur le lineup sélectionné (favori / édition / suppression) ---

function selectedLineup() {
  return visibleLineups().find((l) => l.id === state.selectedLineupId) || null;
}

function updateFavoriteButton(lineup) {
  const btn = document.getElementById("btnToggleFavorite");
  btn.textContent = lineup && lineup.favorite ? "★" : "☆";
  btn.classList.toggle("active", !!(lineup && lineup.favorite));
}

async function toggleFavorite() {
  const selected = selectedLineup();
  if (!selected) return;
  await api().toggle_favorite(selected.id);
  await refreshLineups();
}

function startEditLineup() {
  const selected = selectedLineup();
  if (!selected) return;
  document.getElementById("detailSpotName").classList.add("hidden");
  document.getElementById("detailNotes").classList.add("hidden");
  const spotInput = document.getElementById("detailSpotNameInput");
  const notesInput = document.getElementById("detailNotesInput");
  spotInput.value = selected.spotName;
  notesInput.value = selected.notes || "";
  spotInput.classList.remove("hidden");
  notesInput.classList.remove("hidden");
  document.getElementById("btnEditLineup").classList.add("hidden");
  document.getElementById("btnToggleFavorite").classList.add("hidden");
  document.getElementById("btnDeleteLineup").classList.add("hidden");
  document.getElementById("btnSaveEditLineup").classList.remove("hidden");
  document.getElementById("btnCancelEditLineup").classList.remove("hidden");
}

function exitEditMode() {
  document.getElementById("detailSpotName").classList.remove("hidden");
  document.getElementById("detailNotes").classList.remove("hidden");
  document.getElementById("detailSpotNameInput").classList.add("hidden");
  document.getElementById("detailNotesInput").classList.add("hidden");
  document.getElementById("btnEditLineup").classList.remove("hidden");
  document.getElementById("btnToggleFavorite").classList.remove("hidden");
  document.getElementById("btnDeleteLineup").classList.remove("hidden");
  document.getElementById("btnSaveEditLineup").classList.add("hidden");
  document.getElementById("btnCancelEditLineup").classList.add("hidden");
}

function cancelEditLineup() {
  exitEditMode();
}

async function saveEditLineup() {
  const selected = selectedLineup();
  if (!selected) return;
  const spotName = document.getElementById("detailSpotNameInput").value.trim();
  if (!spotName) return;
  const notes = document.getElementById("detailNotesInput").value;
  await api().update_lineup(selected.id, spotName, notes);
  await refreshLineups();
}

async function deleteLineup() {
  const selected = selectedLineup();
  if (!selected) return;
  if (!confirm(`Supprimer le lineup "${selected.spotName}" ?`)) return;
  await api().delete_lineup(selected.id);
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

  if (!hasRadarCalibration(map) || !startWp) {
    inset.classList.add("hidden");
    return;
  }

  await setRadarImageSrc(img, map.radarImageRef);
  if (generation !== renderGeneration) return; // un rendu plus récent a démarré entre-temps
  inset.classList.remove("hidden");
  const { leftPct, topPct } = worldToRadarPercent(map, startWp.position.x, startWp.position.y);
  setRadarMarker(marker, leftPct, topPct);
}

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
  document.getElementById("view-browse").classList.add("hidden");
  document.getElementById("view-create").classList.remove("hidden");
  if (state.filters.mapId) document.getElementById("form-mapId").value = state.filters.mapId;
  document.getElementById("form-side").value = state.filters.side;
  document.getElementById("btnSaveCapture").disabled = true;
  updateCaptureScreenshot(null);
  toggleInstantPanel();
  armCapture();
  fitCreateRadarSquares();
}

// Taille des radars de #view-create imposée en pixels plutôt qu'en vh : un vh
// devine une proportion de l'écran sans savoir combien le reste du formulaire
// (champs, boutons, texte de statut) occupe réellement — un radar carré basé
// sur un pourcentage d'écran finit soit trop grand (dépasse, scroll forcé) soit
// trop petit selon la résolution. Ici .radar-slot (flex:1 en cascade depuis
// #view-create, voir style.css) reçoit déjà tout l'espace vertical restant une
// fois le reste du formulaire mis en page ; on mesure ce rectangle et on cale
// le radar au plus grand carré qui y rentre — fiable à n'importe quelle taille
// de fenêtre/résolution, recalculé au redimensionnement.
function fitCreateRadarSquares() {
  document.querySelectorAll("#view-create .radar-slot").forEach((slot) => {
    const wrap = slot.querySelector(".radar-wrap");
    if (!wrap) return;
    const size = Math.max(0, Math.min(slot.clientWidth, slot.clientHeight));
    if (size > 0) {
      wrap.style.width = `${size}px`;
      wrap.style.height = `${size}px`;
    } else {
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
  const points = instantSpawnsCache.map((sp) => {
    const { leftPct, topPct } = worldToRadarPercent(map, sp.position.x, sp.position.y);
    return {
      leftPct,
      topPct,
      label: String(sp.index),
      done: instantDoneIdsCache.has(sp.id),
      selected: sp.id === instantSelectedSpawnId,
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
  if (!instantSelectedSpawnId) return;
  document.getElementById("instantPickerStatusLine").textContent = "Téléportation...";
  const result = await api().teleport_to_spawn(instantSelectedSpawnId);
  document.getElementById("instantPickerStatusLine").textContent =
    result.status === "ok"
      ? "Téléporté — vise puis F9 pour capturer."
      : result.message || "Erreur de téléportation.";
}

async function closeCreateView() {
  await api().cancel_capture();
  document.getElementById("view-create").classList.add("hidden");
  document.getElementById("view-browse").classList.remove("hidden");
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
  const category = document.getElementById("form-category").value;
  // start_capture crée un nouveau brouillon (sans waypoint) à chaque appel — un champ
  // modifié après une capture F9 invalide donc ce waypoint côté serveur, il faut
  // recapturer (voir CaptureSession.start dans capture.py).
  captureHasWaypoint = false;
  await api().start_capture(
    document.getElementById("form-mapId").value,
    document.getElementById("form-side").value,
    document.getElementById("form-grenadeType").value,
    document.getElementById("form-spotName").value.trim(),
    document.getElementById("form-notes").value,
    document.getElementById("form-movement").value,
    document.getElementById("form-clickType").value,
    category,
    category === "instant" ? instantSelectedSpawnId : null
  );
  updateSaveButtonState();
  document.getElementById("captureStatusLine").textContent = "Prêt — vise puis appuie sur F9 en jeu pour capturer.";
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
  const result = await api().save_capture();
  if (result.status !== "saved") {
    document.getElementById("captureStatusLine").textContent = result.message || "Erreur lors de la sauvegarde.";
    return;
  }

  if (document.getElementById("form-category").value === "instant") {
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
  state.selectedLineupId = result.lineup.id;
  await refreshLineups();
}

async function toggleHud() {
  const btn = document.getElementById("btnToggleHud");
  const status = document.getElementById("hudToggleStatusLine");
  btn.disabled = true;
  const result = await api().toggle_hud();
  btn.disabled = false;
  status.classList.remove("hidden");

  if (result.status === "hidden") {
    btn.textContent = "Afficher le HUD";
    status.textContent = "HUD masqué — le délai avant que ce soit visible en jeu varie.";
  } else if (result.status === "shown") {
    btn.textContent = "Masquer le HUD (test)";
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
