import { BadRequestException } from '@nestjs/common';
import type { CommunityRotationBossInputDto } from './dto/community-rotation-boss-input.dto';

export type CommunityRotationBossCreateInput = {
  bossId: string | null;
  bossName: string | null;
  position: number;
  notes: string | null;
};

/** Trim and collapse whitespace; compare pending names case-insensitively. */
export function normalizePendingBossName(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function pendingBossNameKey(value: string) {
  return normalizePendingBossName(value).toLocaleLowerCase('pt-BR');
}

export function validateBossStopsInput(
  bosses: CommunityRotationBossInputDto[],
  knownBossIds: Set<string>,
): CommunityRotationBossCreateInput[] {
  if (!bosses?.length) {
    throw new BadRequestException('Informe pelo menos um boss na rotação.');
  }

  const positions = new Set<number>();
  const bossIds = new Set<string>();
  const pendingNames = new Set<string>();

  for (const boss of bosses) {
    if (positions.has(boss.position)) {
      throw new BadRequestException('Posições de boss duplicadas na rotação.');
    }
    positions.add(boss.position);

    if (!boss.bossId && !boss.bossName?.trim()) {
      throw new BadRequestException(
        'Cada parada precisa de um bossId ou bossName.',
      );
    }

    if (boss.bossId) {
      if (bossIds.has(boss.bossId)) {
        throw new BadRequestException(
          'O mesmo boss não pode aparecer mais de uma vez na rotação.',
        );
      }
      if (!knownBossIds.has(boss.bossId)) {
        throw new BadRequestException('Boss do Bosstiário não encontrado.');
      }
      bossIds.add(boss.bossId);
    } else {
      const key = pendingBossNameKey(boss.bossName ?? '');
      if (pendingNames.has(key)) {
        throw new BadRequestException(
          'Nome de boss pendente duplicado na rotação.',
        );
      }
      pendingNames.add(key);
    }
  }

  return bosses.map((item) => ({
    bossId: item.bossId ?? null,
    bossName: item.bossId
      ? null
      : normalizePendingBossName(item.bossName ?? '') || null,
    position: item.position,
    notes: item.notes?.trim() ? item.notes.trim() : null,
  }));
}
