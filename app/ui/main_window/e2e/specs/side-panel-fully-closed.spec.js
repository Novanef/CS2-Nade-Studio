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

test("panneau fermé : aucune chip de la liste ne dépasse visuellement, même près du bord droit", async ({ page }) => {
  await page.locator("#btnToggleLineupPanel").click();
  await expect(page.locator("#lineupPanelWrap")).not.toHaveClass(/open/);
  await page.waitForTimeout(300); // transition CSS de 0.22s (voir .side-panel)

  const viewport = page.viewportSize();
  // Échantillonne une colonne verticale tout près du bord droit de la fenêtre —
  // c'est précisément là que le bug signalé montre des chips qui dépassent encore.
  for (const x of [viewport.width - 5, viewport.width - 15, viewport.width - 25]) {
    for (const y of [100, 300, 500, 650]) {
      const isChip = await page.evaluate(
        ([px, py]) => !!document.elementFromPoint(px, py)?.closest(".chip, .strip, #stripLabel"),
        [x, y]
      );
      expect(isChip, `élément de la liste visible à (${x}, ${y})`).toBe(false);
    }
  }
});
