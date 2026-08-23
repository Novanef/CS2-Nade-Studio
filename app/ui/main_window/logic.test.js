const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  grenadeIconSvg,
  clusterIconSvg,
  hasRadarCalibration,
  worldToRadarPercent,
  computeZoomFrame,
  zoomedPercentX,
  zoomedPercentY,
  groupKey,
  clusterByProximity,
  computeServerMapBadge,
} = require("./logic.js");

test("hasRadarCalibration true seulement si les trois champs sont renseignés", () => {
  assert.equal(hasRadarCalibration(null), false);
  assert.equal(hasRadarCalibration({}), false);
  assert.equal(hasRadarCalibration({ radarPosX: 0, radarPosY: 0, radarScale: null }), false);
  assert.equal(hasRadarCalibration({ radarPosX: 0, radarPosY: 0, radarScale: 5 }), true);
});

test("worldToRadarPercent applique la formule de calibration (voir CLAUDE.md)", () => {
  const map = { radarPosX: -100, radarPosY: 100, radarScale: 1 };
  // px = (x - radarPosX) / radarScale ; py = (radarPosY - y) / radarScale ; /1024*100
  const { leftPct, topPct } = worldToRadarPercent(map, 0, 0);
  assert.equal(leftPct, (100 / 1024) * 100);
  assert.equal(topPct, (100 / 1024) * 100);
});

test("worldToRadarPercent : axe Y inversé entre monde et image", () => {
  const map = { radarPosX: 0, radarPosY: 0, radarScale: 1 };
  const north = worldToRadarPercent(map, 0, 100); // y monde positif
  const south = worldToRadarPercent(map, 0, -100);
  assert.ok(north.topPct < south.topPct, "y monde plus grand => plus haut sur l'image (topPct plus petit)");
});

test("computeZoomFrame encadre un point unique avec la marge minimale", () => {
  const frame = computeZoomFrame([{ leftPct: 50, topPct: 50 }], 0.35, 12);
  assert.equal(frame.span, 12 * 1.35);
  assert.equal(frame.minX, 50 - frame.span / 2);
  assert.equal(frame.minY, 50 - frame.span / 2);
});

test("computeZoomFrame s'élargit pour englober un cluster dispersé", () => {
  const frame = computeZoomFrame([{ leftPct: 10, topPct: 10 }, { leftPct: 30, topPct: 15 }], 0, 5);
  assert.equal(frame.span, 20); // écart max (30-10) sans marge (paddingFrac=0)
});

test("computeZoomFrame recentre le cadre pour ne jamais sortir de [0, 100]", () => {
  const frame = computeZoomFrame([{ leftPct: 2, topPct: 2 }], 0, 20);
  assert.ok(frame.minX >= 0, "le cadre ne doit pas déborder à gauche/en haut");
  assert.ok(frame.minY >= 0);
});

test("zoomedPercentX/Y replacent un point dans le référentiel zoomé", () => {
  const frame = { minX: 10, minY: 20, span: 50 };
  assert.equal(zoomedPercentX(10, frame), 0);
  assert.equal(zoomedPercentX(60, frame), 100);
  assert.equal(zoomedPercentY(20, frame), 0);
});

test("groupKey combine side et spotName (deux groupes de même nom sur des camps différents restent distincts)", () => {
  assert.equal(groupKey({ side: "T", spotName: "Window smoke" }), "T::Window smoke");
  assert.notEqual(
    groupKey({ side: "T", spotName: "Window smoke" }),
    groupKey({ side: "CT", spotName: "Window smoke" })
  );
});

test("grenadeIconSvg retourne un SVG distinct par type connu, et un repli pour un type inconnu", () => {
  const smoke = grenadeIconSvg("smoke");
  const flash = grenadeIconSvg("flash");
  assert.ok(smoke.includes("<svg"));
  assert.notEqual(smoke, flash);
  assert.equal(grenadeIconSvg("inconnu"), smoke);
});

test("clusterIconSvg retourne l'icône du type quand le cluster n'en contient qu'un seul", () => {
  assert.equal(clusterIconSvg(["smoke"]), grenadeIconSvg("smoke"));
  assert.equal(clusterIconSvg(["flash", "flash", "flash"]), grenadeIconSvg("flash"));
});

test("clusterIconSvg retourne une icône dédiée (pas celle d'un des types) quand le cluster mélange des types", () => {
  // Bug signalé : afficher l'icône d'un seul type (ex. le premier lineup du cluster)
  // laisse croire que TOUS les lineups regroupés sont de ce type.
  const mixed = clusterIconSvg(["smoke", "flash"]);
  assert.notEqual(mixed, grenadeIconSvg("smoke"));
  assert.notEqual(mixed, grenadeIconSvg("flash"));
  assert.ok(mixed.includes("<svg"));
});

test("computeServerMapBadge signale un serveur injoignable", () => {
  const badge = computeServerMapBadge(null, "mirage");
  assert.equal(badge.text, "Serveur injoignable");
  assert.equal(badge.variant, "warn");
});

test("computeServerMapBadge est neutre quand la map serveur correspond au filtre", () => {
  const badge = computeServerMapBadge("de_mirage", "mirage");
  assert.equal(badge.variant, "neutral");
});

test("computeServerMapBadge avertit quand la map serveur diffère du filtre", () => {
  const badge = computeServerMapBadge("de_dust2", "mirage");
  assert.equal(badge.text, "Serveur : de_dust2");
  assert.equal(badge.variant, "warn");
});

test("computeServerMapBadge reste neutre si aucun filtre de map n'est sélectionné", () => {
  const badge = computeServerMapBadge("de_dust2", null);
  assert.equal(badge.variant, "neutral");
});

test("clusterByProximity garde des lineups isolés dans des clusters séparés", () => {
  const points = [
    { lineup: "a", leftPx: 0, topPx: 0 },
    { lineup: "b", leftPx: 200, topPx: 200 },
  ];
  const clusters = clusterByProximity(points, 28);
  assert.equal(clusters.length, 2);
  assert.deepEqual(clusters.map((c) => c.items), [["a"], ["b"]]);
});

test("clusterByProximity fusionne les lineups à moins du seuil, sous le centroïde", () => {
  const points = [
    { lineup: "a", leftPx: 0, topPx: 0 },
    { lineup: "b", leftPx: 10, topPx: 0 },
  ];
  const clusters = clusterByProximity(points, 28);
  assert.equal(clusters.length, 1);
  assert.deepEqual(clusters[0].items, ["a", "b"]);
  assert.equal(clusters[0].leftPx, 5); // centroïde des deux points
});

test("clusterByProximity : un troisième point proche du centroïde rejoint le même cluster", () => {
  const points = [
    { lineup: "a", leftPx: 0, topPx: 0 },
    { lineup: "b", leftPx: 10, topPx: 0 },
    { lineup: "c", leftPx: 5, topPx: 5 },
  ];
  const clusters = clusterByProximity(points, 28);
  assert.equal(clusters.length, 1);
  assert.deepEqual(clusters[0].items, ["a", "b", "c"]);
});

test("clusterByProximity avec seuil 0 : chaque point reste isolé sauf coordonnées identiques", () => {
  const points = [
    { lineup: "a", leftPx: 1, topPx: 1 },
    { lineup: "b", leftPx: 1.0001, topPx: 1 },
  ];
  const clusters = clusterByProximity(points, 0);
  assert.equal(clusters.length, 2);
});
