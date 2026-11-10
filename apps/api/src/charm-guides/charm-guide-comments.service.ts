import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CharmGuideStatus, Prisma } from '../../generated/prisma/client.js';
import { PageQueryDto } from '../common/dto/page-query.dto';
import { pageResult, resolvePage } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCharmGuideCommentDto,
  UpdateCharmGuideCommentDto,
} from './dto/create-charm-guide-comment.dto';

const REMOVED = '[comentário removido]';

@Injectable()
export class CharmGuideCommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(guideId: string, query: PageQueryDto, userId: string) {
    await this.requirePublished(guideId);
    const { page, limit, skip } = resolvePage(query);
    const where: Prisma.CharmGuideCommentWhereInput = {
      guideId,
      parentId: null,
    };
    const [total, roots] = await Promise.all([
      this.prisma.charmGuideComment.count({ where }),
      this.prisma.charmGuideComment.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
        include: this.authorInclude(),
      }),
    ]);
    const rootIds = roots.map((row) => row.id);
    const replies = rootIds.length
      ? await this.prisma.charmGuideComment.findMany({
          where: { parentId: { in: rootIds } },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          include: this.authorInclude(),
        })
      : [];
    const all = [...roots, ...replies];
    const liked = await this.likedSet(
      all.map((row) => row.id),
      userId,
    );
    const likeCounts = await this.likeCounts(all.map((row) => row.id));
    const replyMap = new Map<string, typeof replies>();
    for (const reply of replies) {
      if (!reply.parentId) continue;
      const list = replyMap.get(reply.parentId) ?? [];
      list.push(reply);
      replyMap.set(reply.parentId, list);
    }
    return pageResult(
      roots.map((root) => ({
        ...this.serialize(root, liked, likeCounts),
        replies: (replyMap.get(root.id) ?? []).map((reply) =>
          this.serialize(reply, liked, likeCounts),
        ),
      })),
      total,
      page,
      limit,
    );
  }

  async create(guideId: string, userId: string, dto: CreateCharmGuideCommentDto) {
    await this.requirePublished(guideId);
    if (dto.parentId) {
      const parent = await this.prisma.charmGuideComment.findFirst({
        where: { id: dto.parentId, guideId, parentId: null, isDeleted: false },
      });
      if (!parent) {
        throw new BadRequestException('Resposta inválida.');
      }
    }
    const created = await this.prisma.charmGuideComment.create({
      data: {
        guideId,
        userId,
        parentId: dto.parentId ?? null,
        content: dto.content,
      },
      include: this.authorInclude(),
    });
    return this.serialize(created, new Set(), new Map([[created.id, 0]]));
  }

  async update(
    guideId: string,
    commentId: string,
    userId: string,
    dto: UpdateCharmGuideCommentDto,
  ) {
    const comment = await this.requireOwnedComment(guideId, commentId, userId);
    const updated = await this.prisma.charmGuideComment.update({
      where: { id: comment.id },
      data: { content: dto.content, isEdited: true },
      include: this.authorInclude(),
    });
    const liked = await this.likedSet([updated.id], userId);
    const counts = await this.likeCounts([updated.id]);
    return this.serialize(updated, liked, counts);
  }

  async remove(guideId: string, commentId: string, userId: string) {
    const comment = await this.requireOwnedComment(guideId, commentId, userId);
    await this.prisma.charmGuideComment.update({
      where: { id: comment.id },
      data: { isDeleted: true, content: REMOVED },
    });
    return { id: comment.id, isDeleted: true };
  }

  async like(guideId: string, commentId: string, userId: string) {
    await this.requireComment(guideId, commentId);
    await this.prisma.charmGuideCommentLike.upsert({
      where: { commentId_userId: { commentId, userId } },
      create: { commentId, userId },
      update: {},
    });
    return { liked: true };
  }

  async unlike(guideId: string, commentId: string, userId: string) {
    await this.prisma.charmGuideCommentLike.deleteMany({
      where: { commentId, userId },
    });
    return { liked: false };
  }

  private authorInclude() {
    return {
      user: {
        select: {
          id: true,
          activeCharacter: { select: { name: true } },
        },
      },
    } as const;
  }

  private serialize(
    row: {
      id: string;
      content: string;
      isEdited: boolean;
      isDeleted: boolean;
      createdAt: Date;
      updatedAt: Date;
      parentId: string | null;
      user: { id: string; activeCharacter: { name: string } | null };
    },
    liked: Set<string>,
    likeCounts: Map<string, number>,
  ) {
    return {
      id: row.id,
      content: row.isDeleted ? REMOVED : row.content,
      isEdited: row.isEdited,
      isDeleted: row.isDeleted,
      parentId: row.parentId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      likeCount: likeCounts.get(row.id) ?? 0,
      likedByMe: liked.has(row.id),
      author: {
        id: row.user.id,
        name: row.user.activeCharacter?.name ?? 'Jogador',
      },
    };
  }

  private async likedSet(ids: string[], userId: string) {
    if (!ids.length) return new Set<string>();
    const rows = await this.prisma.charmGuideCommentLike.findMany({
      where: { userId, commentId: { in: ids } },
      select: { commentId: true },
    });
    return new Set(rows.map((row) => row.commentId));
  }

  private async likeCounts(ids: string[]) {
    if (!ids.length) return new Map<string, number>();
    const rows = await this.prisma.charmGuideCommentLike.groupBy({
      by: ['commentId'],
      where: { commentId: { in: ids } },
      _count: { _all: true },
    });
    return new Map(rows.map((row) => [row.commentId, row._count._all]));
  }

  private async requirePublished(guideId: string) {
    const guide = await this.prisma.charmGuide.findUnique({
      where: { id: guideId },
      select: { status: true },
    });
    if (!guide || guide.status !== CharmGuideStatus.PUBLISHED) {
      throw new NotFoundException('Guia não encontrado.');
    }
  }

  private async requireComment(guideId: string, commentId: string) {
    const comment = await this.prisma.charmGuideComment.findFirst({
      where: { id: commentId, guideId, isDeleted: false },
    });
    if (!comment) throw new NotFoundException('Comentário não encontrado.');
    return comment;
  }

  private async requireOwnedComment(
    guideId: string,
    commentId: string,
    userId: string,
  ) {
    const comment = await this.requireComment(guideId, commentId);
    if (comment.userId !== userId) {
      throw new ForbiddenException('Você não pode alterar este comentário.');
    }
    return comment;
  }
}
