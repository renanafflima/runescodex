import { ElementType } from '../../generated/prisma/client.js';
import { calculateHuntBestAttack } from './hunt-best-attack';

const row = (element: ElementType, modifier: number) => ({
  element,
  modifier,
});

describe('calculateHuntBestAttack', () => {
  it('selects the element with the highest worst-case modifier', () => {
    const result = calculateHuntBestAttack([
      [row(ElementType.ICE, 120), row(ElementType.FIRE, 90)],
      [row(ElementType.ICE, 110), row(ElementType.FIRE, 105)],
    ]);

    expect(result.elements).toEqual([ElementType.ICE]);
    expect(result.status).toBe('COMPLETE');
  });

  it('returns all elements tied on minimum and average', () => {
    const result = calculateHuntBestAttack([
      [row(ElementType.DEATH, 110), row(ElementType.ICE, 120)],
      [row(ElementType.DEATH, 120), row(ElementType.ICE, 110)],
    ]);

    expect(result.elements).toEqual([ElementType.ICE, ElementType.DEATH]);
  });

  it('uses average as the second tie breaker', () => {
    const result = calculateHuntBestAttack([
      [row(ElementType.ENERGY, 100), row(ElementType.HOLY, 100)],
      [row(ElementType.ENERGY, 120), row(ElementType.HOLY, 110)],
    ]);

    expect(result.elements).toEqual([ElementType.ENERGY]);
  });

  it('allows an immunity to determine the worst case', () => {
    const result = calculateHuntBestAttack([
      [row(ElementType.ICE, 150), row(ElementType.FIRE, 100)],
      [row(ElementType.ICE, 0), row(ElementType.FIRE, 90)],
    ]);

    expect(result.elements).toEqual([ElementType.FIRE]);
  });

  it('does not invent neutral modifiers for missing rows', () => {
    const result = calculateHuntBestAttack([
      [row(ElementType.EARTH, 120)],
      [],
    ]);

    expect(result.elements).toEqual([ElementType.EARTH]);
    expect(result.status).toBe('PARTIAL');
    expect(result.scores[0]).toMatchObject({
      creaturesConsidered: 1,
      creaturesMissing: 1,
    });
  });

  it('returns unavailable when no creature has elemental data', () => {
    expect(calculateHuntBestAttack([[], []])).toEqual({
      elements: [],
      status: 'UNAVAILABLE',
      creatureCount: 2,
      creaturesWithAnyData: 0,
      creaturesWithoutData: 2,
      scores: [],
    });
  });
});
