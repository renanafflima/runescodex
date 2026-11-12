import { NotFoundException } from '@nestjs/common';
import {
  BosstiaryVisibility,
  CommunityRotationStatus,
  PartyMemberStatus,
  PartyStatus,
  UserRole,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import { PUBLIC_STATUSES } from './community-rotation.constants';

export type CommunityRotationAccessRow = {
  id: string;
  userId: string;
  status: CommunityRotationStatus;
  visibility: BosstiaryVisibility;
  partyId: string | null;
};

export async function isActivePartyMember(
  prisma: PrismaService,
  userId: string,
  partyId: string,
) {
  const member = await prisma.partyMember.findUnique({
    where: { partyId_userId: { partyId, userId } },
    select: {
      status: true,
      party: { select: { status: true } },
    },
  });
  return (
    member?.status === PartyMemberStatus.ACTIVE &&
    member.party.status === PartyStatus.ACTIVE
  );
}

export async function loadReadableCommunityRotation(
  prisma: PrismaService,
  rotationId: string,
  userId: string,
  options?: { publishedOnly?: boolean },
): Promise<CommunityRotationAccessRow> {
  const rotation = await prisma.communityRotation.findUnique({
    where: { id: rotationId },
    select: {
      id: true,
      userId: true,
      status: true,
      visibility: true,
      partyId: true,
    },
  });
  if (!rotation) {
    throw new NotFoundException('Rotação não encontrada.');
  }
  if (options?.publishedOnly && !PUBLIC_STATUSES.includes(rotation.status)) {
    throw new NotFoundException('Rotação não encontrada.');
  }
  if (await canReadCommunityRotation(prisma, rotation, userId)) {
    return rotation;
  }
  throw new NotFoundException('Rotação não encontrada.');
}

export async function canReadCommunityRotation(
  prisma: PrismaService,
  rotation: CommunityRotationAccessRow,
  userId: string,
) {
  if (rotation.userId === userId) {
    return true;
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (user?.role === UserRole.ADMIN) {
    return true;
  }
  if (!PUBLIC_STATUSES.includes(rotation.status)) {
    return false;
  }
  if (rotation.visibility === BosstiaryVisibility.PUBLIC) {
    return true;
  }
  if (rotation.visibility === BosstiaryVisibility.PRIVATE) {
    return false;
  }
  if (!rotation.partyId) {
    return false;
  }
  return isActivePartyMember(prisma, userId, rotation.partyId);
}
