// @ts-check
const path = require("node:path");
const { test, expect } = require("@playwright/test");

const INDEX_URL = "file://" + path.join(__dirname, "..", "..", "index.html").replace(/\\/g, "/");
const API_STUB = path.join(__dirname, "..", "fixtures", "api-stub.js");

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: API_STUB });
  await page.setViewportSize({ width: 1000, height: 720 });
  await page.goto(INDEX_URL);
  await expect(page.locator("#detailSpotName")).toHaveText("Window smoke");
});

test("le bouton de bascule fait partie du panneau latéral, pas de la toolbar", async ({ page }) => {
  await expect(page.locator("#lineupPanelWrap #btnToggleLineupPanel")).toHaveCount(1);
  await expect(page.locator(".toolbar #btnToggleLineupPanel")).toHaveCount(0);
});

test("panneau fermé : le bouton reste visible, seule partie visible du panneau", async ({ page }) => {
  await page.locator("#btnToggleLineupPanel").click(); // panneau ouvert par défaut -> ferme
  await expect(page.locator("#lineupPanelWrap")).not.toHaveClass(/open/);
  await page.waitForTimeout(300); // transition CSS de 0.22s (voir .side-panel)

  const button = page.locator("#btnToggleLineupPanel");
  await expect(button).toBeVisible();
  const buttonBox = await button.boundingBox();
  const viewport = page.viewportSize();
  expect(buttonBox).not.toBeNull();
  // Le bouton reste dans la fenêtre (pas poussé hors champ avec le reste du panneau).
  expect(buttonBox.x).toBeGreaterThanOrEqual(0);
  expect(buttonBox.x + buttonBox.width).toBeLessThanOrEqual(viewport.width);

  // Le contenu du panneau (filtres), lui, est repoussé tout au bord (body a un
  // padding de 24px, donc pas pile sur le bord de la fenêtre, mais tout contre).
  const mapSelectBox = await page.locator("#mapSelect").boundingBox();
  expect(mapSelectBox.x).toBeGreaterThanOrEqual(viewport.width - 60);
});

test("cliquer le bouton fait coulisser le panneau et le bouton avec lui", async ({ page }) => {
  const button = page.locator("#btnToggleLineupPanel");
  const openBox = await button.boundingBox();

  await button.click(); // ferme
  await expect(page.locator("#lineupPanelWrap")).not.toHaveClass(/open/);
  await page.waitForTimeout(300); // transition CSS de 0.22s (voir .side-panel)
  const closedBox = await button.boundingBox();

  // Le panneau se rétracte vers la droite -> le bouton, accroché à son bord gauche,
  // doit se déplacer vers la droite lui aussi (pas rester statique dans une toolbar).
  expect(closedBox.x).toBeGreaterThan(openBox.x);
});
