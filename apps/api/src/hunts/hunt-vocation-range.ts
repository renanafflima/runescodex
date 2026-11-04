import { BadRequestException } from '@nestjs/common';
import { Prisma, Vocation } from '../../generated/prisma/client.js';

export type HuntVocationRangeKey = {
  levelMin: number;
  levelMax: number | null;
};

export function huntVocationRangeWhere(
  huntId: string,
  vocation: Vocation,
  range?: HuntVocationRangeKey | null,
): Prisma.HuntVocationWhereInput {
  if (!range) {
    return { huntId, vocation };
  }
  return {
    huntId,
    vocation,
    levelMin: range.levelMin,
    levelMax: range.levelMax,
  };
}

type HuntVocationCounter = {
  huntVocation: {
    count: (args: {
      where: { huntId: string; vocation: Vocation };
    }) => Promise<number>;
  };
};

export async function countHuntVocationRanges(
  client: HuntVocationCounter,
  huntId: string,
  vocation: Vocation,
) {
  return client.huntVocation.count({ where: { huntId, vocation } });
}

/**
 * Resolves the Prisma where clause for updating one HuntVocation row.
 * When range is omitted and the hunt has several ranges for the vocation,
 * throws so callers never update every range at once.
 */
export async function resolveHuntVocationUpdateWhere(
  client: Prisma.TransactionClient,
  huntId: string,
  vocation: Vocation,
  range?: HuntVocationRangeKey | null,
): Promise<Prisma.HuntVocationWhereInput> {
  if (range) {
    return huntVocationRangeWhere(huntId, vocation, range);
  }
  const total = await countHuntVocationRanges(client, huntId, vocation);
  if (total === 0) {
    throw new BadRequestException(
      'Esta Hunt não tem a vocação informada na proposta.',
    );
  }
  if (total > 1) {
    throw new BadRequestException(
      'Esta Hunt possui várias faixas para esta vocação. Informe a faixa (levelMin/levelMax) antes de aplicar a alteração.',
    );
  }
  return { huntId, vocation };
}

export async function applyHuntVocationFieldUpdate(
  tx: Prisma.TransactionClient,
  huntId: string,
  vocation: Vocation,
  range: HuntVocationRangeKey | null | undefined,
  data: Prisma.HuntVocationUpdateManyMutationInput,
) {
  const where = await resolveHuntVocationUpdateWhere(
    tx,
    huntId,
    vocation,
    range ?? null,
  );
  const written = await tx.huntVocation.updateMany({ where, data });
  if (written.count !== 1) {
    throw new BadRequestException(
      'Não foi possível localizar exatamente uma faixa de vocação para aplicar a alteração.',
    );
  }
  return written;
}
