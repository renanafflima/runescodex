export const CREATURES = [
  { id: "c1", name: "Cyclops", difficulty: "Easy", location: "Thais - Cyclops Cave", hp: 260 },
  { id: "c2", name: "Dragon", difficulty: "Medium", location: "Darashia - Dragon Lair", hp: 1000 },
  { id: "c3", name: "Hydra", difficulty: "Hard", location: "Tiquanda - Hydra Cave", hp: 2350 },
  { id: "c4", name: "Demon", difficulty: "Very Hard", location: "Edron - Demon Pits", hp: 8200 },
];

export const HUNTS = [
  {
    id: "h1",
    name: "Cyclops Hunt",
    creature: "Cyclops",
    xpH: 180000,
    profitH: 30000,
    levelMin: 40,
    vocation: "EK",
    rune: "Avalanche Rune",
  },
  {
    id: "h2",
    name: "Dragon Hunt",
    creature: "Dragon",
    xpH: 450000,
    profitH: 60000,
    levelMin: 80,
    vocation: "MS",
    rune: "SD Rune",
  },
  {
    id: "h3",
    name: "Hydra Hunt",
    creature: "Hydra",
    xpH: 900000,
    profitH: 120000,
    levelMin: 150,
    vocation: "RP",
    rune: "Avalanche Rune",
  },
  {
    id: "h4",
    name: "Demon Hunt",
    creature: "Demon",
    xpH: 1200000,
    profitH: 180000,
    levelMin: 250,
    vocation: "ED",
    rune: "SD Rune",
  },
];

export const SHOP_ITEMS = [
  { id: "s1", title: "50 Tibia Coins", cost: 100, description: "Resgate simbólico (mock)" },
  { id: "s2", title: "50 Rubini Coins", cost: 100, description: "Resgate simbólico (mock)" },
  { id: "s3", title: "10% Desconto Netshoes", cost: 250, description: "Cupom simbólico (mock)" },
  { id: "s4", title: "Badge VIP no App", cost: 50, description: "Emblema dentro do app (mock)" },
];