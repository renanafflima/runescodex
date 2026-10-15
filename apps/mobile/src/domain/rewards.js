/** Approved Points → Gold packages. Must match apps/api rewards.constants. */
export const POINTS_TO_GOLD = [
  {
    id: "gold1",
    imageKey: "gold1",
    amount: 1,
    pointsCost: 10_000,
    kicker: "Conversão padrão",
    title: "1 GOLD COIN",
    hint: "Troque seus pontos por 1 Gold permanente.",
  },
  {
    id: "gold5",
    imageKey: "gold5",
    amount: 5,
    pointsCost: 45_000,
    kicker: "Pacote com bônus",
    title: "5 GOLD COINS",
    hint: "Troque seus pontos por 5 Gold permanentes.",
  },
];

export const DIAMOND_OFFERS = [
  {
    id: "diamond1",
    imageKey: "diamond1",
    amount: 1,
    kicker: "Moeda permanente",
    title: "1 DIAMOND",
    hint: "Use Gold acumulado para conquistar 1 Diamond.",
  },
  {
    id: "diamond3",
    imageKey: "diamond3",
    amount: 3,
    kicker: "Pacote",
    title: "3 DIAMONDS",
    hint: "Pacote para quem quer acelerar o acúmulo de Diamonds.",
  },
];

export function formatPoints(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "0";
  return amount.toLocaleString("pt-BR");
}

function toMillis(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return new Date(value).getTime();
}

export function formatRenewal(periodEnd, now = Date.now()) {
  const end = toMillis(periodEnd);
  const start = toMillis(now);
  if (!Number.isFinite(end) || !Number.isFinite(start)) return null;
  const diff = end - start;
  if (diff <= 0) return "0m";
  const totalMinutes = Math.floor(diff / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${String(hours).padStart(2, "0")}h`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  return `${minutes}m`;
}

export function mapGoldPackages(apiPackages) {
  const provided = Array.isArray(apiPackages);
  const rows = provided ? apiPackages : [];
  const byAmount = new Map(rows.map((row) => [Number(row?.amount), row]));

  return POINTS_TO_GOLD.map((pack) => {
    const fromApi = byAmount.get(pack.amount);
    const apiCost = Number(fromApi?.pointsCost);
    const hasApiCost = Number.isFinite(apiCost) && apiCost > 0;
    const pointsCost = hasApiCost ? apiCost : pack.pointsCost;
    const unitCost = provided ? Number(byAmount.get(1)?.pointsCost) : POINTS_TO_GOLD[0].pointsCost;
    const comparedCost = provided ? apiCost : pack.pointsCost;
    const savings =
      pack.amount > 1 && Number.isFinite(unitCost) && unitCost > 0 && Number.isFinite(comparedCost) && comparedCost > 0
        ? unitCost * pack.amount - comparedCost
        : 0;
    return {
      ...pack,
      pointsCost,
      price: `${formatPoints(pointsCost)} pontos`,
      savings: savings > 0 ? savings : 0,
      enabled: provided ? Boolean(fromApi && fromApi.enabled !== false && hasApiCost) : true,
    };
  });
}

export function mapDiamondOffers(goldToDiamond) {
  const rate = goldToDiamond?.rate;
  const goldCost = Number(rate?.goldCost);
  const diamondGranted = Number(rate?.diamondGranted);
  const enabled = Boolean(
    goldToDiamond?.enabled && Number.isFinite(goldCost) && goldCost > 0 && Number.isFinite(diamondGranted) && diamondGranted > 0,
  );

  return DIAMOND_OFFERS.map((offer) => {
    if (!enabled || offer.amount % diamondGranted !== 0) {
      return { ...offer, enabled: false, goldCost: null, price: null };
    }
    const cost = (offer.amount / diamondGranted) * goldCost;
    return {
      ...offer,
      enabled: true,
      goldCost: cost,
      price: `${formatPoints(cost)} Gold`,
    };
  });
}

export function finiteCount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

export function missionProgressPercent(current, target) {
  const goal = finiteCount(target);
  if (goal <= 0) return 0;
  const done = finiteCount(current);
  if (done <= 0) return 0;
  return Math.min(100, (done / goal) * 100);
}

export function affordancePercent(balance, price, priceConfigured) {
  const cost = Number(price);
  const have = Number(balance);
  if (!priceConfigured || !Number.isFinite(cost) || cost <= 0) return null;
  if (!Number.isFinite(have) || have <= 0) return 0;
  return Math.min(100, Math.round((have / cost) * 100));
}

export function chunkRows(list, size) {
  const width = Math.max(1, Number(size) || 1);
  const rows = [];
  const items = Array.isArray(list) ? list : [];
  for (let index = 0; index < items.length; index += width) {
    rows.push(items.slice(index, index + width));
  }
  return rows;
}
