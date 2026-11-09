import { Injectable } from '@nestjs/common';
import {
  AppNotificationKind,
  Prisma,
} from '../../generated/prisma/client.js';
import { pageResult, resolvePage } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { PARTY_LIMITS } from './party.constants';

type NotifyInput = {
  userId: string;
  kind: AppNotificationKind;
  title: string;
  body: string;
  partyId?: string | null;
  sessionId?: string | null;
};

@Injectable()
export class PartyNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notify(input: NotifyInput, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma;
    return db.appNotification.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        title: input.title.slice(0, PARTY_LIMITS.notificationTitleMax),
        body: input.body.slice(0, PARTY_LIMITS.notificationBodyMax),
        partyId: input.partyId ?? null,
        sessionId: input.sessionId ?? null,
      },
    });
  }

  async list(userId: string, query: { page?: number; limit?: number }) {
    const { page, limit, skip } = resolvePage(query);
    const where = { userId };
    const [total, rows] = await Promise.all([
      this.prisma.appNotification.count({ where }),
      this.prisma.appNotification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
    ]);
    return pageResult(rows, total, page, limit);
  }

  async markRead(userId: string, id: string) {
    await this.prisma.appNotification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { id, read: true };
  }
}
