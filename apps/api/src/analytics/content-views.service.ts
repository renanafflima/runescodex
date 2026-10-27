import { BadRequestException, Injectable } from '@nestjs/common';
import { ContentSubject } from '../../generated/prisma/client.js';
import {
  hourBucket,
  isSessionKey,
  normalizeSearchTerm,
} from '../admin/insights/admin-text';
import { PrismaService } from '../prisma/prisma.service';

const BOSS_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

@Injectable()
export class ContentViewsService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: {
    subject: ContentSubject;
    subjectId: string;
    sessionKey: string;
    userId?: string;
  }) {
    if (!isSessionKey(input.sessionKey)) {
      throw new BadRequestException('Sessão de visualização inválida.');
    }
    await this.assertSubject(input.subject, input.subjectId);
    try {
      await this.prisma.contentViewEvent.create({
        data: {
          subject: input.subject,
          subjectId: input.subjectId,
          sessionKey: input.sessionKey,
          userId: input.userId ?? null,
          bucketStart: hourBucket(new Date()),
        },
      });
      return { recorded: true, duplicate: false };
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        return { recorded: false, duplicate: true };
      }
      throw error;
    }
  }

  async recordSearchMiss(term: string, category: 'HUNT' | 'HUNT_CLIENT') {
    const normalized = normalizeSearchTerm(term);
    if (!normalized) {
      throw new BadRequestException('Termo de busca inválido.');
    }
    await this.prisma.searchMiss.create({
      data: { category, term: normalized },
    });
    return { recorded: true };
  }

  private async assertSubject(subject: ContentSubject, subjectId: string) {
    if (subject === 'BOSS') {
      if (!BOSS_SLUG.test(subjectId) || subjectId.length > 80) {
        throw new BadRequestException('Boss inválido.');
      }
      return;
    }
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        subjectId,
      )
    ) {
      throw new BadRequestException('Identificador inválido.');
    }
    if (subject === 'HUNT') {
      const hunt = await this.prisma.hunt.findFirst({
        where: { id: subjectId, isActive: true },
        select: { id: true },
      });
      if (!hunt) throw new BadRequestException('Hunt não encontrada.');
      return;
    }
    const creature = await this.prisma.creature.findFirst({
      where: { id: subjectId, isActive: true },
      select: { id: true },
    });
    if (!creature) throw new BadRequestException('Criatura não encontrada.');
  }
}
