// @ts-check
const path = require("node:path");
const { test, expect } = require("@playwright/test");

const INDEX_URL = "file://" + path.join(__dirname, "..", "..", "index.html").replace(/\\/g, "/");
const API_STUB = path.join(__dirname, "..", "fixtures", "api-stub.js");

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: API_STUB });
  await page.setViewportSize({ width: 900, height: 800 });
  await page.goto(INDEX_URL);
  await expect(page.locator("#detailSpotName")).toHaveText("Window smoke");
  await page.locator("#radarWrap").click();
  await expect(page.locator("#view-radar-fullscreen")).toBeVisible();
  // Le panneau de filtres (partagé avec la consultation, voir radar-fullscreen-filters.spec.js)
  // est ouvert par défaut et flotte par-dessus le bord droit du radar — pas le sujet de
  // ces tests, qui portent sur les marqueurs/clusters : on le ferme pour l'écarter.
  await page.locator("#btnToggleLineupPanel").click();
});

test("le radar occupe la quasi-totalité de la fenêtre", async ({ page }) => {
  const box = await page.locator("#radarFullscreenWrap").boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  // Carré calé sur le plus petit côté disponible (fitRadarFullscreenSquare) — doit
  // rester proche de la hauteur de fenêtre, pas un petit encart comme avant.
  expect(box.height).toBeGreaterThan(viewport.height * 0.7);
});

test("les lineups proches se regroupent sous une icône avec badge, même de types différents (bug signalé)", async ({ page }) => {
  const markers = page.locator(".radar-marker-icon");
  // 4 clusters attendus : {std-window (smoke), std-window-2 (smoke), std-window-flash
  // (flash)} fusionnés — le regroupement se fait par PROXIMITÉ, pas par type, sinon la
  // flash se superpose pile sur la smoke et devient invisible (bug signalé) — puis
  // std-far-smoke (smoke, loin) isolé, std-ramp (flash, loin) isolé, {std-edge-1,
  // std-edge-2} fusionnés (he).
  await expect(markers).toHaveCount(4);

  const badgedMarkers = markers.filter({ has: page.locator(".marker-badge") });
  await expect(badgedMarkers).toHaveCount(2);
  await expect(badgedMarkers.first().locator(".marker-badge")).toHaveText("3");
  await expect(badgedMarkers.last().locator(".marker-badge")).toHaveText("2");

  // Le cluster mélangé (smoke+smoke+flash) ne doit afficher ni l'icône smoke ni
  // l'icône flash (ça laisserait croire que tout le cluster est de ce type — bug
  // signalé), mais une icône dédiée "types mixtes". Le cluster uniforme (he+he)
  // garde lui l'icône de son type.
  const mixedIcon = await badgedMarkers.first().innerHTML();
  expect(mixedIcon).not.toContain("#9ca3af"); // fill de l'icône smoke
  expect(mixedIcon).not.toContain("#fbbf24"); // fill de l'icône flash
  const uniformIcon = await badgedMarkers.last().innerHTML();
  expect(uniformIcon).toContain("#4d7c0f"); // fill de l'icône he
});

test("cliquer un marqueur groupé ouvre un popover listant le type de chaque lineup pour choisir", async ({ page }) => {
  // Premier marqueur avec badge dans l'ordre du DOM = le cluster "Window" (3 items,
  // types mélangés smoke/smoke/flash).
  const badgedMarker = page.locator(".radar-marker-icon").filter({ has: page.locator(".marker-badge") }).first();
  await badgedMarker.click();

  const popover = page.locator(".radar-cluster-popover");
  await expect(popover).toBeVisible();
  const entries = popover.locator("button");
  await expect(entries).toHaveCount(3);
  // Ordre = ordre d'insertion dans le cluster. Le type de grenade doit apparaître pour
  // distinguer les entrées d'un cluster mélangé (sinon même souci de confusion que le
  // bug signalé, mais dans le popover cette fois).
  await expect(entries.nth(0)).toContainText("Window smoke");
  await expect(entries.nth(0)).toContainText("Smoke");
  await expect(entries.nth(0)).toContainText("Jumpthrow");
  await expect(entries.nth(1)).toContainText("Window smoke (dup)");
  await expect(entries.nth(1)).toContainText("Smoke");
  await expect(entries.nth(2)).toContainText("Window flash");
  await expect(entries.nth(2)).toContainText("Flash");

  // Chaque entrée montre l'icône de SON propre type (pas celle, potentiellement
  // trompeuse, du marqueur groupé) — smoke pour les deux premières, flash pour la 3e.
  await expect(entries.nth(0).locator("svg")).toHaveCount(1);
  expect(await entries.nth(0).innerHTML()).toContain("#9ca3af"); // fill icône smoke
  expect(await entries.nth(1).innerHTML()).toContain("#9ca3af");
  expect(await entries.nth(2).innerHTML()).toContain("#fbbf24"); // fill icône flash

  await entries.nth(2).click();

  // Retour à la vue de consultation, avec le lineup flash choisi (pas le premier du cluster).
  await expect(page.locator("#view-radar-fullscreen")).toBeHidden();
  await expect(page.locator("#detailSpotName")).toHaveText("Window flash");
});

test("cliquer en dehors du popover le ferme sans rien sélectionner", async ({ page }) => {
  const badgedMarker = page.locator(".radar-marker-icon").filter({ has: page.locator(".marker-badge") }).first();
  await badgedMarker.click();
  await expect(page.locator(".radar-cluster-popover")).toBeVisible();

  // Coin bas-gauche, loin de la topbar (bouton "Retour" + titre, ancrés en haut-gauche
  // par-dessus le radar) pour ne pas la déclencher par erreur.
  await page.locator("#radarFullscreenWrap").click({ position: { x: 5, y: 500 } });

  await expect(page.locator(".radar-cluster-popover")).toBeHidden();
  // Toujours sur le radar plein écran, aucune sélection n'a changé.
  await expect(page.locator("#view-radar-fullscreen")).toBeVisible();
});

test("un lineup isolé reste sélectionnable directement, sans popover", async ({ page }) => {
  const markers = page.locator(".radar-marker-icon");
  const isolatedMarker = markers.filter({ hasNot: page.locator(".marker-badge") }).first();
  await isolatedMarker.click();

  await expect(page.locator(".radar-cluster-popover")).toHaveCount(0);
  await expect(page.locator("#view-radar-fullscreen")).toBeHidden();
});

test("les lineups instant n'apparaissent jamais sur ce radar", async ({ page }) => {
  // Fixture : 2 lineups instant (spotName "Instant window") — ne doivent produire
  // aucun marqueur, même si le filtre camp/recherche ne les exclut pas explicitement.
  await expect(page.locator(".radar-marker-icon")).toHaveCount(4);
  for (const marker of await page.locator(".radar-marker-icon").all()) {
    await expect(marker).not.toHaveAttribute("title", /Instant window/);
  }
});

test("le popover d'un cluster proche du bord du radar reste entièrement visible (bug signalé)", async ({ page }) => {
  // Cluster fixture {std-edge-1, std-edge-2} positionné à ~92% de la largeur du
  // radar — reproduit le popover coupé signalé par l'utilisateur (screenshot :
  // le popover dépassait hors du radar et se faisait couper par overflow:hidden).
  const edgeMarker = page.locator(".radar-marker-icon").filter({ has: page.locator(".marker-badge") }).last();
  await edgeMarker.click();

  const popover = page.locator(".radar-cluster-popover");
  await expect(popover).toBeVisible();

  const popoverBox = await popover.boundingBox();
  const wrapBox = await page.locator("#radarFullscreenWrap").boundingBox();
  expect(popoverBox).not.toBeNull();
  expect(wrapBox).not.toBeNull();

  // Le popover doit rester entièrement contenu dans le radar, pas dépasser à droite
  // (ni en haut/bas) où il se ferait couper par le overflow:hidden du conteneur.
  expect(popoverBox.x).toBeGreaterThanOrEqual(wrapBox.x);
  expect(popoverBox.x + popoverBox.width).toBeLessThanOrEqual(wrapBox.x + wrapBox.width + 1);
  expect(popoverBox.y).toBeGreaterThanOrEqual(wrapBox.y);
  expect(popoverBox.y + popoverBox.height).toBeLessThanOrEqual(wrapBox.y + wrapBox.height + 1);
});
