/**
 * Rewards missions/catalog seed.
 * Catalog prices are provisional.
 * Only COMMUNITY missions with real forum events stay active.
 */
export const REWARD_MISSIONS = [
  {
    title: "Explore 3 Novas Áreas",
    description: "Visite e marque novas áreas no mapa.",
    category: "EXPLORATION",
    period: "DAILY",
    target: 3,
    pointsReward: 40,
    imageKey: "missionExploration",
    eventType: "EXPLORATION_COMPLETED",
    active: false,
  },
  {
    title: "Pesquise 2 Criaturas",
    description: "Pesquise informações de criaturas no app.",
    category: "BESTIARY",
    period: "DAILY",
    target: 2,
    pointsReward: 30,
    imageKey: "missionBestiary",
    eventType: "BESTIARY_ACTION",
    active: false,
  },
  {
    title: "Poste no Fórum",
    description: "Crie um tópico útil no fórum da comunidade.",
    category: "COMMUNITY",
    period: "DAILY",
    target: 1,
    pointsReward: 20,
    imageKey: "missionForum",
    eventType: "FORUM_TOPIC_CREATED",
    active: true,
  },
  {
    title: "Faça 3 comentários",
    description: "Responda tópicos úteis no fórum da comunidade.",
    category: "COMMUNITY",
    period: "DAILY",
    target: 3,
    pointsReward: 25,
    imageKey: "missionForum",
    eventType: "FORUM_COMMENT_CREATED",
    active: true,
  },
  {
    title: "Complete 3 Hunts",
    description: "Complete qualquer hunt e registre sua atividade no app.",
    category: "HUNT",
    period: "WEEKLY",
    target: 3,
    pointsReward: 150,
    imageKey: "missionHunts",
    eventType: "HUNT_ACTION",
    active: false,
  },
  {
    title: "Compartilhe o RuneCodex",
    description: "Compartilhe uma página ou recurso do app.",
    category: "PROMOTION",
    period: "WEEKLY",
    target: 1,
    pointsReward: 250,
    imageKey: "promotion",
    eventType: "PROMOTION_COMPLETED",
    active: false,
  },
  {
    title: "Estude o Codex",
    description: "Consulte conteúdos e guias da comunidade.",
    category: "KNOWLEDGE",
    period: "WEEKLY",
    target: 1,
    pointsReward: 80,
    imageKey: "knowledge",
    eventType: "KNOWLEDGE_ANSWERED",
    active: false,
  },
  {
    title: "Recrute um Aventureiro",
    description: "Convide um novo jogador usando seu código.",
    category: "RECRUITMENT",
    period: "MONTHLY",
    target: 1,
    pointsReward: 2000,
    imageKey: "recruitment",
    eventType: "REFERRAL_CONFIRMED",
    active: false,
  },
  {
    title: "Ouça a Trilha",
    description: "Explore a seção de músicas do RuneCodex.",
    category: "MUSIC",
    period: "MONTHLY",
    target: 1,
    pointsReward: 100,
    imageKey: "music",
    eventType: "MUSIC_COMPLETED",
    active: false,
  },
];

export const REWARD_CATALOG = [
  {
    name: "125 Tibia Coins",
    description: "Recompensa digital para sua conta.",
    imageKey: "tc125",
    currency: "GOLD",
    price: 5,
    sortOrder: 1,
    active: true,
  },
  {
    name: "250 Tibia Coins",
    description: "Uma recompensa maior para quem evolui.",
    imageKey: "tc250",
    currency: "GOLD",
    price: 10,
    sortOrder: 2,
    active: true,
  },
  {
    name: "500 Rubini Coins",
    description: "Coins para usar dentro do Rubini.",
    imageKey: "rc500",
    currency: "GOLD",
    price: 15,
    sortOrder: 3,
    active: true,
  },
  {
    name: "1.000 Rubini Coins",
    description: "Uma das recompensas mais cobiçadas.",
    imageKey: "rc1000",
    currency: "GOLD",
    price: 25,
    sortOrder: 4,
    active: true,
  },
  {
    name: "Ferumbras Hat",
    description: "Recompensa rara para quem alcançou a economia premium.",
    imageKey: "ferumbrasHat",
    currency: "DIAMOND",
    price: 3,
    sortOrder: 5,
    active: true,
  },
];

export async function seedRewards(prisma) {
  for (const mission of REWARD_MISSIONS) {
    const existing = await prisma.rewardMission.findFirst({
      where: {
        title: mission.title,
        period: mission.period,
        category: mission.category,
      },
    });
    if (existing) {
      await prisma.rewardMission.update({
        where: { id: existing.id },
        data: {
          description: mission.description,
          target: mission.target,
          pointsReward: mission.pointsReward,
          imageKey: mission.imageKey,
          eventType: mission.eventType,
          active: mission.active,
        },
      });
    } else {
      await prisma.rewardMission.create({ data: mission });
    }
  }

  for (const item of REWARD_CATALOG) {
    await prisma.rewardCatalogItem.upsert({
      where: { imageKey: item.imageKey },
      update: {
        name: item.name,
        description: item.description,
        currency: item.currency,
        price: item.price,
        sortOrder: item.sortOrder,
        active: item.active,
      },
      create: item,
    });
  }

  console.log(
    `Seeded ${REWARD_MISSIONS.length} reward missions and ${REWARD_CATALOG.length} catalog items. Catalog prices are provisional (TC/RC Gold, Hat 3 Diamond) and may change in the database.`,
  );
}
