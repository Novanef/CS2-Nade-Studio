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

function rectsOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

test("la vue de consultation occupe toute la fenêtre, sans marge (photo plein cadre)", async ({ page }) => {
  const box = await page.locator("#view-browse").boundingBox();
  const viewport = page.viewportSize();
  expect(box.x).toBeLessThanOrEqual(1);
  expect(box.y).toBeLessThanOrEqual(1);
  expect(box.x + box.width).toBeGreaterThanOrEqual(viewport.width - 1);
  expect(box.y + box.height).toBeGreaterThanOrEqual(viewport.height - 1);
});

test("le panneau latéral ouvert touche le bord droit de la fenêtre", async ({ page }) => {
  const box = await page.locator("#lineupPanel").boundingBox();
  const viewport = page.viewportSize();
  expect(box.x + box.width).toBeGreaterThanOrEqual(viewport.width - 1);
});

test("le radar plein écran occupe toute la fenêtre, sans marge", async ({ page }) => {
  await page.locator("#radarWrap").click();
  await expect(page.locator("#view-radar-fullscreen")).toBeVisible();
  const box = await page.locator("#view-radar-fullscreen").boundingBox();
  const viewport = page.viewportSize();
  expect(box.x).toBeLessThanOrEqual(1);
  expect(box.y).toBeLessThanOrEqual(1);
  expect(box.x + box.width).toBeGreaterThanOrEqual(viewport.width - 1);
  expect(box.y + box.height).toBeGreaterThanOrEqual(viewport.height - 1);
});

test("le bouton de bascule du panneau ne recouvre pas les boutons d'action du lineup", async ({ page }) => {
  const handleBox = await page.locator("#btnToggleLineupPanel").boundingBox();
  const deleteBox = await page.locator("#btnDeleteLineup").boundingBox();
  const editBox = await page.locator("#btnEditLineup").boundingBox();
  expect(rectsOverlap(handleBox, deleteBox), "le bouton ☰ recouvre \"Supprimer\"").toBe(false);
  expect(rectsOverlap(handleBox, editBox), "le bouton ☰ recouvre \"Éditer\"").toBe(false);
});
