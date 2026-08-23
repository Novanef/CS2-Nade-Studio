// @ts-check
const path = require("node:path");
const { test, expect } = require("@playwright/test");

const INDEX_URL = "file://" + path.join(__dirname, "..", "..", "index.html").replace(/\\/g, "/");
const API_STUB = path.join(__dirname, "..", "fixtures", "api-stub.js");

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: API_STUB });
  await page.goto(INDEX_URL);
  await expect(page.locator("#detailSpotName")).toHaveText("Window smoke");
});

test("supprimer le lineup du spawn sélectionné le repasse à l'état non capturé, le groupe reste ouvert", async ({
  page,
}) => {
  await page.getByText("Instant window").click();
  await expect(page.locator("#instantGroupBar")).toBeVisible();
  await expect(page.locator("#instantGroupSubtitle")).toContainText("2/2");

  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#btnDeleteSpawnLineup").click();

  await expect(page.locator("#instantGroupBar")).toBeVisible();
  await expect(page.locator("#instantGroupSubtitle")).toContainText("1/2");
  await expect(page.locator("#instantGroupShotImg")).toBeHidden();
  await expect(page.locator("#instantGroupShotEmpty")).toHaveText("Pas encore capturé pour ce spawn.");
  await expect(page.locator("#btnOpenSpawnLineup")).toBeHidden();
  await expect(page.locator("#btnDeleteSpawnLineup")).toBeHidden();
});

test("annuler la confirmation de suppression d'un spawn ne change rien", async ({ page }) => {
  await page.getByText("Instant window").click();
  await expect(page.locator("#instantGroupShotImg")).toBeVisible();

  page.once("dialog", (dialog) => dialog.dismiss());
  await page.locator("#btnDeleteSpawnLineup").click();

  await expect(page.locator("#instantGroupSubtitle")).toContainText("2/2");
  await expect(page.locator("#instantGroupShotImg")).toBeVisible();
});

test("supprimer tout le groupe revient à la vue standard", async ({ page }) => {
  await page.getByText("Instant window").click();
  await expect(page.locator("#instantGroupBar")).toBeVisible();

  page.once("dialog", (dialog) => {
    expect(dialog.message()).toContain("Instant window");
    dialog.accept();
  });
  await page.locator("#btnDeleteInstantGroup").click();

  await expect(page.locator("#instantGroupBar")).toBeHidden();
  await expect(page.locator("#lineupDetail")).toBeVisible();
  await expect(page.locator("#lineupStrip .chip", { hasText: "Instant window" })).toHaveCount(0);
});

test("annuler la confirmation de suppression du groupe ne change rien", async ({ page }) => {
  await page.getByText("Instant window").click();
  await expect(page.locator("#instantGroupBar")).toBeVisible();

  page.once("dialog", (dialog) => dialog.dismiss());
  await page.locator("#btnDeleteInstantGroup").click();

  await expect(page.locator("#instantGroupBar")).toBeVisible();
  await expect(page.locator("#instantGroupTitle")).toHaveText("Instant window");
});
