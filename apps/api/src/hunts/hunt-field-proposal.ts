import { BadRequestException } from '@nestjs/common';
import {
  HuntUpdateRequestType,
  Vocation,
} from '../../generated/prisma/client.js';

const AUTO_APPLICABLE = new Set<HuntUpdateRequestType>([
  HuntUpdateRequestType.XP,
  HuntUpdateRequestType.PROFIT,
  HuntUpdateRequestType.LEVEL,
  HuntUpdateRequestType.LOCATION,
]);

export function isAutoApplicableHuntUpdate(type: HuntUpdateRequestType) {
  return AUTO_APPLICABLE.has(type);
}

export function parseProposedHuntNumber(
  type: 'XP' | 'PROFIT' | 'LEVEL',
  raw: string,
) {
  if (!/^-?\d+$/.test(raw)) {
    throw new BadRequestException(
      'O valor proposto precisa ser um número inteiro, sem texto.',
    );
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    throw new BadRequestException('Valor fora da faixa permitida.');
  }
  if (type === 'XP' && (value < 0 || value > 50_000_000)) {
    throw new BadRequestException('XP/h fora da faixa permitida.');
  }
  if (type === 'PROFIT' && (value < -50_000_000 || value > 50_000_000)) {
    throw new BadRequestException('Lucro/h fora da faixa permitida.');
  }
  if (type === 'LEVEL' && (value < 1 || value > 10_000)) {
    throw new BadRequestException('Level fora da faixa permitida.');
  }
  return value;
}

export function huntVocationProposalData(
  type: 'XP' | 'PROFIT' | 'LEVEL',
  value: number,
) {
  if (type === 'XP') return { xpPerHour: value };
  if (type === 'PROFIT') return { profitPerHour: value };
  return { levelMin: value };
}

export function assertHuntVocation(vocation: Vocation | null | undefined) {
  if (!vocation) {
    throw new BadRequestException(
      'Uma proposta de XP, lucro ou level precisa informar a vocação.',
    );
  }
  return vocation;
}
