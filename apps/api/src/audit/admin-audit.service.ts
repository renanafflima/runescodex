import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { pageResult, resolvePage } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';

export type AuditWrite = {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  metadata?: Prisma.InputJsonObject;
};

@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  record(input: AuditWrite, db?: Prisma.TransactionClient) {
    const client = db ?? this.prisma;
    return client.adminAuditEvent.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action.slice(0, 80),
        entityType: input.entityType.slice(0, 40),
        entityId: input.entityId.slice(0, 80),
        summary: input.summary.slice(0, 280),
        metadata: input.metadata,
      },
    });
  }

  async list(query: {
    page?: number;
    limit?: number;
    action?: string;
    entityType?: string;
    actorUserId?: string;
    from?: string;
    to?: string;
  }) {
    const { page, limit, skip } = resolvePage(query);
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    const where: Prisma.AdminAuditEventWhereInput = {
      ...(query.action ? { action: query.action } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lt: to } : {}),
            },
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.adminAuditEvent.count({ where }),
      this.prisma.adminAuditEvent.findMany({
        where,
        include: {
          actor: {
            select: {
              id: true,
              activeCharacter: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);
    return pageResult(
      rows.map((row) => ({
        id: row.id,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        summary: row.summary,
        metadata: row.metadata,
        createdAt: row.createdAt,
        actor: {
          id: row.actor.id,
          name: row.actor.activeCharacter?.name ?? null,
        },
      })),
      total,
      page,
      limit,
    );
  }
}
