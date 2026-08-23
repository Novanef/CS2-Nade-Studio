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

test("le panneau de filtres est accessible depuis le radar plein écran", async ({ page }) => {
  await page.locator("#radarWrap").click();
  await expect(page.locator("#view-radar-fullscreen")).toBeVisible();

  // Le panneau est ouvert par défaut, ses filtres doivent être atteignables/visibles
  // par-dessus le radar (pas cachés derrière #view-browse).
  await expect(page.locator("#mapSelect")).toBeVisible();
  await expect(page.locator("#categoryPills")).toBeVisible();
});

test("changer un filtre pendant que le radar plein écran est ouvert met à jour les marqueurs sans fermer la vue", async ({ page }) => {
  await page.locator("#radarWrap").click();
  await expect(page.locator("#view-radar-fullscreen")).toBeVisible();
  await expect(page.locator(".radar-marker-icon")).toHaveCount(4);

  await page.getByRole("button", { name: "Flash", exact: true }).click();

  // Toujours sur le radar plein écran — le filtre ne referme pas la vue.
  await expect(page.locator("#view-radar-fullscreen")).toBeVisible();
  // "Ramp flash" et "Window flash" sont de type flash parmi les lineups standards.
  await expect(page.locator(".radar-marker-icon")).toHaveCount(2);
});

test("le panneau de filtres ne flotte pas par-dessus la vue de création", async ({ page }) => {
  await page.locator("#btnNewLineup").click();
  await expect(page.locator("#view-create")).toBeVisible();
  await expect(page.locator("#lineupPanelWrap")).toBeHidden();
});

function rectsOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

test("le panneau pousse le radar plutôt que de le recouvrir", async ({ page }) => {
  await page.locator("#radarWrap").click();
  await expect(page.locator("#view-radar-fullscreen")).toBeVisible();

  const panel = page.locator("#lineupPanel");
  await expect(panel).toBeVisible(); // ouvert par défaut

  const radarBoxWithPanel = await page.locator("#radarFullscreenWrap").boundingBox();
  const panelBox = await panel.boundingBox();
  expect(
    rectsOverlap(radarBoxWithPanel, panelBox),
    "le radar et le panneau de filtres ne doivent jamais se recouvrir"
  ).toBe(false);

  // Le radar doit vraiment être rétréci pour laisser la place (pas juste "ne pas se
  // superposer par coïncidence") : en fermant le panneau, il doit redevenir plus large.
  await page.locator("#btnToggleLineupPanel").click();
  await page.waitForTimeout(300); // transition CSS de 0.22s (voir .side-panel-wrap)
  const radarBoxWithoutPanel = await page.locator("#radarFullscreenWrap").boundingBox();
  expect(radarBoxWithoutPanel.width).toBeGreaterThan(radarBoxWithPanel.width);
});
