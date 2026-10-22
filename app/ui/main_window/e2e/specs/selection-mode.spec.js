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

const instantChip = (page) => page.locator("#lineupStrip .chip", { hasText: "Instant window" });

test("en mode sélection, un spot instant a une case à cocher et sélectionne tout son groupe", async ({ page }) => {
  await page.locator("#btnSelectionMode").click();

  await expect(instantChip(page).locator("input.chip-select")).toHaveCount(1);
  await instantChip(page).click();

  // Le groupe "Instant window" compte 2 lineups (un par spawn) dans la fixture.
  await expect(instantChip(page).locator("input.chip-select")).toBeChecked();
  await expect(page.locator("#deleteSelectionCount")).toHaveText("2");
  // Le clic sélectionne, il n'ouvre pas la vue du groupe.
  await expect(page.locator("#instantGroupBar")).toBeHidden();
});

test("recliquer un spot instant sélectionné le désélectionne", async ({ page }) => {
  await page.locator("#btnSelectionMode").click();
  await instantChip(page).click();

  await instantChip(page).click();

  await expect(instantChip(page).locator("input.chip-select")).not.toBeChecked();
  await expect(page.locator("#btnDeleteSelection")).toBeHidden();
});

test("supprimer une sélection mêlant standard et instant supprime tout le groupe", async ({ page }) => {
  await page.locator("#btnSelectionMode").click();
  await page.locator("#lineupStrip .chip", { hasText: "Ramp flash" }).click();
  await instantChip(page).click();
  await expect(page.locator("#deleteSelectionCount")).toHaveText("3");

  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#btnDeleteSelection").click();

  await expect(instantChip(page)).toHaveCount(0);
  await expect(page.locator("#lineupStrip .chip", { hasText: "Ramp flash" })).toHaveCount(0);
});

test("supprimer toute la bibliothèque après confirmation vide la liste", async ({ page }) => {
  page.once("dialog", (dialog) => {
    // 9 lineups dans la fixture, toutes cartes confondues.
    expect(dialog.message()).toContain("9 lineup(s)");
    dialog.accept();
  });
  await page.locator("#btnDeleteLibrary").click();

  await expect(page.locator("#lineupStrip .chip")).toHaveCount(0);
});

test("annuler la suppression de toute la bibliothèque ne change rien", async ({ page }) => {
  const before = await page.locator("#lineupStrip .chip").count();

  page.once("dialog", (dialog) => dialog.dismiss());
  await page.locator("#btnDeleteLibrary").click();

  await expect(page.locator("#lineupStrip .chip")).toHaveCount(before);
  await expect(page.locator("#detailSpotName")).toHaveText("Window smoke");
});
