// @ts-check
const path = require("node:path");
const { test, expect } = require("@playwright/test");

const INDEX_URL = "file://" + path.join(__dirname, "..", "..", "index.html").replace(/\\/g, "/");
const API_STUB = path.join(__dirname, "..", "fixtures", "api-stub.js");

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: API_STUB });
  // Rejoue le stub complet puis bascule get_mode() sur "consultation" — voir
  // main_consultation.py, qui expose BrowseApi (get_mode() === "consultation")
  // plutôt que Api (get_mode() === "full").
  await page.addInitScript(() => {
    window.pywebview.api.get_mode = async () => "consultation";
  });
  await page.goto(INDEX_URL);
  await expect(page.locator("#detailSpotName")).toHaveText("Window smoke");
});

test("masque les contrôles de capture/édition en mode consultation", async ({ page }) => {
  await expect(page.locator("body")).toHaveClass(/consultation-mode/);
  await expect(page.locator("#btnNewLineup")).toBeHidden();
  await expect(page.locator("#btnEditLineup")).toBeHidden();
  await expect(page.locator("#serverMapBadge")).toBeHidden();
});

test("garde les contrôles de browse (favori, suppression, export, import) visibles", async ({ page }) => {
  await expect(page.locator("#btnToggleFavorite")).toBeVisible();
  await expect(page.locator("#btnDeleteLineup")).toBeVisible();
  await expect(page.locator("#btnExportLibrary")).toBeVisible();
  await expect(page.locator("#btnImportLineups")).toBeVisible();
});

test("le radar et le détail du lineup restent consultables normalement", async ({ page }) => {
  await page.getByText("Ramp flash").click();

  await expect(page.locator("#detailSpotName")).toHaveText("Ramp flash");
  await expect(page.locator("#detailScreenshotImg")).toHaveAttribute(
    "src",
    "data:image/png;base64,DETAIL_shot-std-ramp.png"
  );
});
