// @ts-check
const path = require("node:path");
const { test, expect } = require("@playwright/test");

const INDEX_URL = "file://" + path.join(__dirname, "..", "..", "index.html").replace(/\\/g, "/");
const API_STUB = path.join(__dirname, "..", "fixtures", "api-stub.js");

// La chip "Window smoke" et "Window smoke (dup)" partagent le même préfixe de texte
// (pas de séparateur entre spotName et le <br>, voir le rendu des chips dans
// renderLineups()) — on exclut explicitement la variante "(dup)" pour cibler la bonne.
function windowSmokeChip(strip) {
  return strip.locator(".chip", { hasText: "Window smoke" }).filter({ hasNotText: "(dup)" });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: API_STUB });
  await page.goto(INDEX_URL);
  await expect(page.locator("#detailSpotName")).toHaveText("Window smoke");
});

test("par défaut, la liste affiche les lineups standards et les groupes instant", async ({ page }) => {
  const strip = page.locator("#lineupStrip");
  await expect(windowSmokeChip(strip)).toBeVisible();
  await expect(strip.getByText("Instant window")).toBeVisible();
});

test("activer le filtre affiche uniquement les groupes instant", async ({ page }) => {
  await page.locator("#instantOnlyToggle").click();

  const strip = page.locator("#lineupStrip");
  await expect(strip.getByText("Instant window")).toBeVisible();
  // Plus aucune des 6 entrées standards de la fixture ne doit apparaître.
  await expect(windowSmokeChip(strip)).toHaveCount(0);
  await expect(strip.getByText("Window smoke (dup)")).toHaveCount(0);
  await expect(strip.getByText("Ramp flash")).toHaveCount(0);
  await expect(strip.getByText("Far smoke")).toHaveCount(0);
  await expect(strip.getByText("Edge HE", { exact: false })).toHaveCount(0);
});

test("le bouton de filtre reflète visuellement son état actif", async ({ page }) => {
  const toggle = page.locator("#instantOnlyToggle");
  await expect(toggle).not.toHaveClass(/active/);
  await toggle.click();
  await expect(toggle).toHaveClass(/active/);
  await toggle.click();
  await expect(toggle).not.toHaveClass(/active/);
});

test("désactiver le filtre restaure l'affichage complet", async ({ page }) => {
  const toggle = page.locator("#instantOnlyToggle");
  const strip = page.locator("#lineupStrip");

  await toggle.click();
  await expect(windowSmokeChip(strip)).toHaveCount(0);

  await toggle.click();
  await expect(windowSmokeChip(strip)).toBeVisible();
  await expect(strip.getByText("Instant window")).toBeVisible();
});

test("le filtre instant-only se combine avec la recherche texte", async ({ page }) => {
  await page.locator("#instantOnlyToggle").click();
  await page.locator("#searchInput").fill("window");

  const strip = page.locator("#lineupStrip");
  await expect(strip.getByText("Instant window")).toBeVisible();

  await page.locator("#searchInput").fill("nope-does-not-exist");
  await expect(strip.locator(".chip")).toHaveCount(0);
});
