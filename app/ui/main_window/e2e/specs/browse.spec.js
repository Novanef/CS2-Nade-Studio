// @ts-check
const path = require("node:path");
const { test, expect } = require("@playwright/test");

const INDEX_URL = "file://" + path.join(__dirname, "..", "..", "index.html").replace(/\\/g, "/");
const API_STUB = path.join(__dirname, "..", "fixtures", "api-stub.js");

test.beforeEach(async ({ page }) => {
  // Injecté avant tout script de la page — window.pywebview existe déjà quand
  // main.js teste sa présence (voir le bas de main.js).
  await page.addInitScript({ path: API_STUB });
  await page.goto(INDEX_URL);
  await expect(page.locator("#detailSpotName")).toHaveText("Window smoke");
});

test("le premier lineup standard est sélectionné et affiche son propre screenshot", async ({ page }) => {
  await expect(page.locator("#detailScreenshotImg")).toHaveAttribute(
    "src",
    "data:image/png;base64,DETAIL_shot-std-window.png"
  );
  // screenshotZoomRef présent pour ce lineup => l'incrustation zoom doit être visible.
  await expect(page.locator("#zoomInset")).toBeVisible();
});

test("cliquer un autre lineup standard met à jour le screenshot affiché (régression du jour)", async ({ page }) => {
  await page.getByText("Ramp flash").click();

  await expect(page.locator("#detailSpotName")).toHaveText("Ramp flash");
  await expect(page.locator("#detailScreenshotImg")).toHaveAttribute(
    "src",
    "data:image/png;base64,DETAIL_shot-std-ramp.png"
  );
  // Ce lineup n'a pas de screenshotZoomRef => l'incrustation zoom doit disparaître,
  // pas rester affichée avec l'image du lineup précédent.
  await expect(page.locator("#zoomInset")).toBeHidden();
});

test("changer de carte sans lineup enregistré affiche le radar sans marqueur (pas masqué)", async ({ page }) => {
  await page.selectOption("#mapSelect", "ancient");

  await expect(page.locator("#radarInset")).toBeVisible();
  await expect(page.locator("#radarMarker")).toBeHidden();
});

test("ouvrir un groupe instant affiche sa grille de spawns et le screenshot du spawn sélectionné", async ({ page }) => {
  await page.getByText("Instant window").click();

  await expect(page.locator("#instantGroupBar")).toBeVisible();
  // Filtre camp = "Tous" par défaut => le camp du groupe (T) se voit à la teinte
  // de la barre plutôt qu'en texte entre parenthèses (voir renderInstantGroupView :
  // state.filters.side === null).
  await expect(page.locator("#instantGroupTitle")).toHaveText("Instant window");
  await expect(page.locator("#instantGroupBar")).toHaveClass(/side-t/);
  // 2 spawns pour ce groupe (fixture) => 2 marqueurs sur le radar zoomé.
  await expect(page.locator("#instantGroupRadarWrap .instant-marker")).toHaveCount(2);
  // Le spawn 1 a un lineup capturé => auto-sélectionné, son screenshot doit s'afficher.
  await expect(page.locator("#instantGroupShotImg")).toHaveAttribute(
    "src",
    "data:image/png;base64,DETAIL_shot-instant-1.png"
  );
});

test("sélectionner le spawn 2 (sans waypoint) du groupe instant affiche l'état vide, pas l'ancien screenshot", async ({ page }) => {
  await page.getByText("Instant window").click();
  await expect(page.locator("#instantGroupShotImg")).toBeVisible();

  await page.locator("#instantGroupRadarWrap .instant-marker", { hasText: "2" }).click();

  await expect(page.locator("#instantGroupShotImg")).toBeHidden();
  await expect(page.locator("#instantGroupShotEmpty")).toBeVisible();
  await expect(page.locator("#instantGroupShotEmpty")).toHaveText("Pas de screenshot.");
});
