import { BadRequestException } from '@nestjs/common';
import { validateBossStopsInput } from './community-rotation-bosses.validation';

describe('validateBossStopsInput', () => {
  const known = new Set(['boss-a', 'boss-b']);

  it('accepts distinct registered bosses', () => {
    const stops = validateBossStopsInput(
      [
        { bossId: 'boss-a', position: 1 },
        { bossId: 'boss-b', position: 2 },
      ],
      known,
    );
    expect(stops).toEqual([
      { bossId: 'boss-a', bossName: null, position: 1, notes: null },
      { bossId: 'boss-b', bossName: null, position: 2, notes: null },
    ]);
  });

  it('rejects duplicate bossId', () => {
    expect(() =>
      validateBossStopsInput(
        [
          { bossId: 'boss-a', position: 1 },
          { bossId: 'boss-a', position: 2 },
        ],
        known,
      ),
    ).toThrow(BadRequestException);
  });

  it('accepts a pending boss name', () => {
    const stops = validateBossStopsInput(
      [{ bossName: '  Mystery Lord  ', position: 1 }],
      known,
    );
    expect(stops[0]).toMatchObject({
      bossId: null,
      bossName: 'Mystery Lord',
      position: 1,
    });
  });

  it('rejects duplicate pending names ignoring case and spacing', () => {
    expect(() =>
      validateBossStopsInput(
        [
          { bossName: 'Mystery Lord', position: 1 },
          { bossName: '  mystery   lord ', position: 2 },
        ],
        known,
      ),
    ).toThrow(BadRequestException);
  });
});
