import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import type { CreateCommunityRotationDto } from './dto/create-community-rotation.dto';
import { pendingBossNameKey } from './community-rotation-bosses.validation';

export const COMMUNITY_ROTATION_IDEMPOTENCY_KEY_MAX = 128;

export function sanitizeCommunityRotationIdempotencyKey(raw?: string) {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > COMMUNITY_ROTATION_IDEMPOTENCY_KEY_MAX) {
    throw new BadRequestException('Idempotency-Key excede o tamanho máximo.');
  }
  return trimmed;
}

export function hashCommunityRotationCreatePayload(
  dto: CreateCommunityRotationDto,
): string {
  const bosses = [...dto.bosses]
    .sort((left, right) => left.position - right.position)
    .map((boss) => {
      if (boss.bossId) {
        return {
          position: boss.position,
          bossId: boss.bossId,
          bossName: null as string | null,
          notes: boss.notes?.trim() ? boss.notes.trim() : null,
        };
      }
      return {
        position: boss.position,
        bossId: null as string | null,
        bossName: pendingBossNameKey(boss.bossName ?? ''),
        notes: boss.notes?.trim() ? boss.notes.trim() : null,
      };
    });

  const canonical = {
    title: dto.title.trim(),
    description: dto.description?.trim() ?? null,
    accessRequirements: dto.accessRequirements?.trim() ?? null,
    additionalInfo: dto.additionalInfo?.trim() ?? null,
    recommendedLevel: dto.recommendedLevel,
    huntMode: dto.huntMode,
    plannedDurationMinutes: dto.plannedDurationMinutes,
    vocation: dto.vocation ?? null,
    characterLevel: dto.characterLevel ?? null,
    partySize: dto.partySize ?? null,
    observedTotalMinutes: dto.observedTotalMinutes ?? null,
    combatMinutes: dto.combatMinutes ?? null,
    travelMinutes: dto.travelMinutes ?? null,
    visibility: dto.visibility ?? 'PUBLIC',
    partyId: dto.partyId ?? null,
    bosses,
  };

  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
