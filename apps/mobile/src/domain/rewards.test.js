import assert from "node:assert/strict";
import test from "node:test";
import {
  affordancePercent,
  chunkRows,
  formatRenewal,
  mapDiamondOffers,
  mapGoldPackages,
  missionProgressPercent,
} from "./rewards.js";

test("renewal countdown follows the mission period end", () => {
  const end = "2026-10-10T00:00:00.000Z";
  const now = new Date("2026-10-09T09:38:00.000Z");
  assert.equal(formatRenewal(end, now), "14h 22m");
  assert.equal(formatRenewal("2026-10-12T08:00:00.000Z", "2026-10-09T00:00:00.000Z"), "3d 08h");
  assert.equal(formatRenewal("not-a-date", now), null);
  assert.equal(formatRenewal(end, "2026-10-10T00:00:00.000Z"), "0m");
});

test("gold packages use the API cost and the approved fallback", () => {
  const fromApi = mapGoldPackages([
    { amount: 1, pointsCost: 10_000, enabled: true },
    { amount: 5, pointsCost: 45_000, enabled: true },
  ]);
  assert.equal(fromApi[0].price, "10.000 pontos");
  assert.equal(fromApi[1].price, "45.000 pontos");
  assert.equal(fromApi[1].savings, 5_000);

  const fallback = mapGoldPackages(null);
  assert.equal(fallback[0].pointsCost, 10_000);
  assert.equal(fallback[1].pointsCost, 45_000);
  assert.equal(fallback[1].enabled, true);

  const partial = mapGoldPackages([{ amount: 1, pointsCost: 8_000, enabled: true }]);
  assert.equal(partial[0].enabled, true);
  assert.equal(partial[0].pointsCost, 8_000);
  assert.equal(partial[1].enabled, false);
  assert.equal(partial[1].savings, 0);
});

test("diamond offers stay disabled until the API publishes a rate", () => {
  const closed = mapDiamondOffers({ enabled: false, rate: null });
  assert.equal(closed.every((offer) => offer.enabled === false), true);
  assert.equal(closed.every((offer) => offer.price == null), true);

  const open = mapDiamondOffers({
    enabled: true,
    rate: { goldCost: 10, diamondGranted: 1 },
  });
  assert.deepEqual(
    open.map((offer) => [offer.amount, offer.goldCost, offer.enabled]),
    [
      [1, 10, true],
      [3, 30, true],
    ],
  );
});

test("store progress uses the real wallet and ignores an unpriced item", () => {
  assert.equal(affordancePercent(29, 50, true), 58);
  assert.equal(affordancePercent(0, 5, true), 0);
  assert.equal(affordancePercent(10, 0, false), null);
  assert.equal(affordancePercent(3, 0, true), null);
});

test("mission progress never divides by zero", () => {
  assert.equal(Math.round(missionProgressPercent(1, 3)), 33);
  assert.equal(missionProgressPercent(4, 2), 100);
  assert.equal(missionProgressPercent(1, 0), 0);
  assert.equal(missionProgressPercent("nope", 2), 0);
});

test("grids follow the available width", () => {
  assert.deepEqual(
    chunkRows(["a", "b", "c", "d", "e"], 2).map((row) => row.length),
    [2, 2, 1],
  );
  assert.equal(chunkRows(["a", "b", "c"], 3)[0].length, 3);
});
