// @ts-check
const path = require("node:path");
const { test, expect } = require("@playwright/test");

const INDEX_URL = "file://" + path.join(__dirname, "..", "..", "index.html").replace(/\\/g, "/");
const API_STUB = path.join(__dirname, "..", "fixtures", "api-stub.js");

// Reproduit le bug rapporté : dans la vue groupée "instant smoke", une fois un spawn
// capturé sélectionné, "Éditer ce lineup" (#btnOpenSpawnLineup) devait ouvrir le
// formulaire pré-rempli avec CE lineup instant précis. Avant le correctif,
// state.selectedLineupId était réécrasé au rendu suivant (visibleLineups()/
// selectedLineup() excluent category === "instant"), donc soit le bouton "Éditer"
// restait grisé, soit il ouvrait un lineup standard sans rapport.
test("éditer un instant lineup depuis la vue groupée ouvre le bon formulaire et revient au bon groupe", async ({
  page,
}) => {
  await page.addInitScript({ path: API_STUB });
  await page.goto(INDEX_URL);
  await expect(page.locator("#detailSpotName")).toHaveText("Window smoke");

  // Entrer dans la vue groupée du spot instant (un seul groupe "Instant window").
  const strip = page.locator("#lineupStrip");
  await strip.locator(".chip", { hasText: "Instant window" }).click();
  await expect(page.locator("#instantGroupBar")).toBeVisible();

  // Le spawn avec un lineup capturé (instant-1 / spawn-1) est sélectionné par défaut.
  const editSpawnBtn = page.locator("#btnOpenSpawnLineup");
  await expect(editSpawnBtn).toBeVisible();
  await expect(editSpawnBtn).not.toBeDisabled();

  await editSpawnBtn.click();

  // Le formulaire d'édition doit s'ouvrir pré-rempli avec le lineup instant choisi,
  // pas grisé sans effet, ni ouvert sur un lineup standard au hasard.
  await expect(page.locator("#view-create")).toBeVisible();
  await expect(page.locator("#view-browse")).toBeHidden();
  await expect(page.locator("#createViewTitle")).toHaveText("Éditer lineup");
  await expect(page.locator("#form-mapId")).toHaveValue("mirage");
  await expect(page.locator("#form-side")).toHaveValue("T");
  await expect(page.locator("#form-grenadeType")).toHaveValue("smoke");
  await expect(page.locator("#form-category")).toHaveValue("instant");
  await expect(page.locator("#form-spotName")).toHaveValue("Instant window");

  // Un waypoint existe déjà (instant-1) : le bouton Sauvegarder doit être actif direct.
  await expect(page.locator("#btnSaveCapture")).not.toBeDisabled();
  await page.locator("#btnSaveCapture").click();

  // Retour à la bibliothèque, dans le même groupe instant (pas la vue standard).
  await expect(page.locator("#view-browse")).toBeVisible();
  await expect(page.locator("#instantGroupBar")).toBeVisible();
  await expect(
    strip.locator(".chip", { hasText: "Instant window" })
  ).toHaveClass(/active/);
});
