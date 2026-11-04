import { ElementType } from '../../generated/prisma/client.js';

export type CreatureElementModifier = {
  element: ElementType;
  modifier: number;
};

export type HuntBestAttackScore = {
  element: ElementType;
  minimumModifier: number;
  averageModifier: number;
  creaturesConsidered: number;
  creaturesMissing: number;
};

export type HuntBestAttack = {
  elements: ElementType[];
  status: 'COMPLETE' | 'PARTIAL' | 'UNAVAILABLE';
  creatureCount: number;
  creaturesWithAnyData: number;
  creaturesWithoutData: number;
  scores: HuntBestAttackScore[];
};

const ELEMENTS: readonly ElementType[] = [
  ElementType.PHYSICAL,
  ElementType.EARTH,
  ElementType.FIRE,
  ElementType.ICE,
  ElementType.ENERGY,
  ElementType.DEATH,
  ElementType.HOLY,
];

const EPSILON = 1e-9;

export function calculateHuntBestAttack(
  creatures: readonly (readonly CreatureElementModifier[])[],
): HuntBestAttack {
  const creatureCount = creatures.length;
  const creaturesWithAnyData = creatures.filter(
    (elements) => elements.length > 0,
  ).length;
  const scores = ELEMENTS.flatMap((element) => {
    const modifiers = creatures.flatMap((elements) => {
      const row = elements.find((item) => item.element === element);
      return row ? [row.modifier] : [];
    });
    if (modifiers.length === 0) return [];
    return [
      {
        element,
        minimumModifier: Math.min(...modifiers),
        averageModifier:
          modifiers.reduce((sum, modifier) => sum + modifier, 0) /
          modifiers.length,
        creaturesConsidered: modifiers.length,
        creaturesMissing: creatureCount - modifiers.length,
      },
    ];
  });

  if (scores.length === 0) {
    return {
      elements: [],
      status: 'UNAVAILABLE',
      creatureCount,
      creaturesWithAnyData,
      creaturesWithoutData: creatureCount - creaturesWithAnyData,
      scores: [],
    };
  }

  const bestMinimum = Math.max(...scores.map((score) => score.minimumModifier));
  const minimumWinners = scores.filter(
    (score) => score.minimumModifier === bestMinimum,
  );
  const bestAverage = Math.max(
    ...minimumWinners.map((score) => score.averageModifier),
  );
  const winners = minimumWinners.filter(
    (score) => Math.abs(score.averageModifier - bestAverage) < EPSILON,
  );
  const complete = winners.every(
    (score) => score.creaturesConsidered === creatureCount,
  );

  return {
    elements: winners.map((score) => score.element),
    status: complete ? 'COMPLETE' : 'PARTIAL',
    creatureCount,
    creaturesWithAnyData,
    creaturesWithoutData: creatureCount - creaturesWithAnyData,
    scores,
  };
}
