import { NotFoundException } from '@nestjs/common';
import {
  BosstiaryVisibility,
  CommunityRotationStatus,
} from '../../generated/prisma/client.js';
import {
  canReadCommunityRotation,
  loadReadableCommunityRotation,
} from './community-rotation-access';

describe('community-rotation-access', () => {
  const prisma = {
    communityRotation: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    partyMember: { findUnique: jest.fn() },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({ role: 'USER' });
    prisma.partyMember.findUnique.mockResolvedValue(null);
  });

  it('lets party members read GROUP rotations and blocks outsiders', async () => {
    const rotation = {
      id: 'rot-1',
      userId: 'author',
      status: CommunityRotationStatus.PUBLISHED,
      visibility: BosstiaryVisibility.GROUP,
      partyId: 'party-1',
    };
    prisma.partyMember.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      party: { status: 'ACTIVE' },
    });
    await expect(canReadCommunityRotation(prisma as never, rotation, 'member')).resolves.toBe(
      true,
    );

    prisma.partyMember.findUnique.mockResolvedValue(null);
    await expect(canReadCommunityRotation(prisma as never, rotation, 'outsider')).resolves.toBe(
      false,
    );
  });

  it('keeps PRIVATE rotations on the author diary', async () => {
    const rotation = {
      id: 'rot-1',
      userId: 'author',
      status: CommunityRotationStatus.PUBLISHED,
      visibility: BosstiaryVisibility.PRIVATE,
      partyId: null,
    };
    await expect(canReadCommunityRotation(prisma as never, rotation, 'author')).resolves.toBe(
      true,
    );
    await expect(canReadCommunityRotation(prisma as never, rotation, 'other')).resolves.toBe(
      false,
    );
  });

  it('returns 404 when a former member hits the rotation endpoint', async () => {
    prisma.communityRotation.findUnique.mockResolvedValue({
      id: 'rot-1',
      userId: 'author',
      status: CommunityRotationStatus.PUBLISHED,
      visibility: BosstiaryVisibility.GROUP,
      partyId: 'party-1',
    });
    prisma.partyMember.findUnique.mockResolvedValue({
      status: 'LEFT',
      party: { status: 'ACTIVE' },
    });
    await expect(
      loadReadableCommunityRotation(prisma as never, 'rot-1', 'former'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
