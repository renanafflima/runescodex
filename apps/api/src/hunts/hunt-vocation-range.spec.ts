import { BadRequestException } from '@nestjs/common';
import {
  applyHuntVocationFieldUpdate,
  huntVocationRangeWhere,
  resolveHuntVocationUpdateWhere,
} from './hunt-vocation-range';

describe('hunt-vocation-range', () => {
  it('builds an exact range filter when levelMax is null', () => {
    expect(
      huntVocationRangeWhere('hunt-1', 'ED', { levelMin: 400, levelMax: null }),
    ).toEqual({
      huntId: 'hunt-1',
      vocation: 'ED',
      levelMin: 400,
      levelMax: null,
    });
  });

  it('allows a single-range vocation without an explicit range key', async () => {
    const tx = {
      huntVocation: {
        count: jest.fn().mockResolvedValue(1),
        updateMany: jest.fn(),
      },
    };
    await expect(
      resolveHuntVocationUpdateWhere(tx as never, 'hunt-1', 'EK'),
    ).resolves.toEqual({ huntId: 'hunt-1', vocation: 'EK' });
  });

  it('rejects ambiguous updates when several ranges exist and none was identified', async () => {
    const tx = {
      huntVocation: {
        count: jest.fn().mockResolvedValue(2),
      },
    };
    await expect(
      resolveHuntVocationUpdateWhere(tx as never, 'hunt-1', 'ED'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates only the identified range row', async () => {
    const tx = {
      huntVocation: {
        count: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    await applyHuntVocationFieldUpdate(
      tx as never,
      'hunt-1',
      'ED',
      { levelMin: 400, levelMax: 600 },
      { xpPerHour: 3_500_000 },
    );
    expect(tx.huntVocation.updateMany).toHaveBeenCalledWith({
      where: {
        huntId: 'hunt-1',
        vocation: 'ED',
        levelMin: 400,
        levelMax: 600,
      },
      data: { xpPerHour: 3_500_000 },
    });
  });
});
