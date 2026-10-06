import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { pageResult, resolvePage } from '../common/pagination';
import { PageQueryDto } from '../common/dto/page-query.dto';
import { CreateHuntCommentDto } from './dto/create-hunt-comment.dto';
import { UpdateHuntCommentDto } from './dto/update-hunt-comment.dto';

export const REMOVED_COMMENT_TEXT = 'Comentário removido.';

const COMMENT_SELECT = {
  id: true,
  content: true,
  isEdited: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
  parentId: true,
  user: {
    select: {
      id: true,
      activeCharacter: { select: { name: true } },
    },
  },
} as const;

export type PublicComment = {
  id: string;
  content: string;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  user: { id: string; name: string | null };
  likesCount: number;
  likedByMe: boolean;
  replies: PublicComment[];
};

type CommentRow = {
  id: string;
  content: string;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  parentId: string | null;
  user: {
    id: string;
    activeCharacter: { name: string } | null;
  };
};

@Injectable()
export class HuntCommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(slug: string, query: PageQueryDto, userId?: string) {
    const hunt = await this.requireHunt(slug);
    const { page, limit, skip } = resolvePage(query);
    const rootWhere = { huntId: hunt.id, parentId: null };
    const [total, commentCount, roots] = await Promise.all([
      this.prisma.huntComment.count({ where: rootWhere }),
      this.prisma.huntComment.count({ where: { huntId: hunt.id } }),
      this.prisma.huntComment.findMany({
        where: rootWhere,
        select: COMMENT_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
    ]);
    const rootIds = roots.map((comment) => comment.id);
    const replies =
      rootIds.length === 0
        ? []
        : await this.prisma.huntComment.findMany({
            where: { huntId: hunt.id, parentId: { in: rootIds } },
            select: COMMENT_SELECT,
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          });
    const engagement = await this.engagement(
      [...rootIds, ...replies.map((comment) => comment.id)],
      userId,
    );
    const repliesByParent = new Map<string, CommentRow[]>();
    for (const reply of replies) {
      const parentId = reply.parentId;
      if (!parentId) {
        continue;
      }
      const group = repliesByParent.get(parentId) ?? [];
      group.push(reply);
      repliesByParent.set(parentId, group);
    }

    return {
      ...pageResult(
        roots.map((comment) =>
          this.serialize(
            comment,
            engagement,
            (repliesByParent.get(comment.id) ?? []).map((reply) =>
              this.serialize(reply, engagement),
            ),
          ),
        ),
        total,
        page,
        limit,
      ),
      commentCount,
    };
  }

  async create(slug: string, userId: string, dto: CreateHuntCommentDto) {
    const hunt = await this.requireHunt(slug);
    const parentId = await this.resolveParent(hunt.id, dto.parentId);
    const created = await this.prisma.huntComment.create({
      data: {
        huntId: hunt.id,
        userId,
        parentId,
        content: dto.content,
      },
      select: COMMENT_SELECT,
    });
    return this.serialize(created, emptyEngagement());
  }

  async update(
    slug: string,
    commentId: string,
    userId: string,
    dto: UpdateHuntCommentDto,
  ) {
    const comment = await this.requireOwnedComment(slug, commentId, userId);
    if (comment.isDeleted) {
      throw new BadRequestException(
        'Não é possível editar um comentário removido.',
      );
    }
    const updated = await this.prisma.huntComment.update({
      where: { id: comment.id },
      data: { content: dto.content, isEdited: true },
      select: COMMENT_SELECT,
    });
    const engagement = await this.engagement([updated.id], userId);
    return this.serialize(updated, engagement);
  }

  async remove(slug: string, commentId: string, userId: string) {
    const comment = await this.requireOwnedComment(slug, commentId, userId);
    if (comment.isDeleted) {
      throw new BadRequestException('Comentário já removido.');
    }
    const updated = await this.prisma.huntComment.update({
      where: { id: comment.id },
      data: { isDeleted: true },
      select: COMMENT_SELECT,
    });
    const engagement = await this.engagement([updated.id], userId);
    return this.serialize(updated, engagement);
  }

  async like(slug: string, commentId: string, userId: string) {
    const comment = await this.requireComment(slug, commentId);
    if (comment.isDeleted) {
      throw new BadRequestException(
        'Não é possível curtir um comentário removido.',
      );
    }
    try {
      await this.prisma.huntCommentLike.create({
        data: { commentId: comment.id, userId },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Você já curtiu este comentário.');
      }
      throw error;
    }
    return this.likeState(comment.id, userId, true);
  }

  async unlike(slug: string, commentId: string, userId: string) {
    const comment = await this.requireComment(slug, commentId);
    const removed = await this.prisma.huntCommentLike.deleteMany({
      where: { commentId: comment.id, userId },
    });
    if (removed.count !== 1) {
      throw new NotFoundException('Curtida não encontrada.');
    }
    return this.likeState(comment.id, userId, false);
  }

  private async requireHunt(slug: string) {
    const hunt = await this.prisma.hunt.findFirst({
      where: { slug, isActive: true },
      select: { id: true },
    });
    if (!hunt) {
      throw new NotFoundException('Hunt not found');
    }
    return hunt;
  }

  private async requireComment(slug: string, commentId: string) {
    const hunt = await this.requireHunt(slug);
    const comment = await this.prisma.huntComment.findFirst({
      where: { id: commentId, huntId: hunt.id },
      select: {
        id: true,
        huntId: true,
        userId: true,
        isDeleted: true,
        parentId: true,
      },
    });
    if (!comment) {
      throw new NotFoundException('Comentário não encontrado.');
    }
    return comment;
  }

  private async requireOwnedComment(
    slug: string,
    commentId: string,
    userId: string,
  ) {
    const comment = await this.requireComment(slug, commentId);
    if (comment.userId !== userId) {
      throw new ForbiddenException('Você não pode alterar este comentário.');
    }
    return comment;
  }

  private async resolveParent(huntId: string, parentId?: string) {
    if (!parentId) {
      return null;
    }
    const parent = await this.prisma.huntComment.findFirst({
      where: { id: parentId },
      select: { id: true, huntId: true, parentId: true, isDeleted: true },
    });
    if (!parent) {
      throw new NotFoundException('Comentário não encontrado.');
    }
    if (parent.huntId !== huntId) {
      throw new BadRequestException(
        'A resposta precisa pertencer à mesma hunt.',
      );
    }
    if (parent.parentId) {
      throw new BadRequestException(
        'Só é possível responder um comentário principal.',
      );
    }
    if (parent.isDeleted) {
      throw new BadRequestException(
        'Não é possível responder um comentário removido.',
      );
    }
    return parent.id;
  }

  private async engagement(commentIds: string[], userId?: string) {
    if (commentIds.length === 0) {
      return emptyEngagement();
    }
    const likedQuery: Promise<{ commentId: string }[]> = userId
      ? this.prisma.huntCommentLike.findMany({
          where: { userId, commentId: { in: commentIds } },
          select: { commentId: true },
        })
      : Promise.resolve([]);
    const [counts, mine] = await Promise.all([
      this.prisma.huntCommentLike.groupBy({
        by: ['commentId'],
        where: { commentId: { in: commentIds } },
        _count: { _all: true },
      }),
      likedQuery,
    ]);
    return {
      counts: new Map(counts.map((row) => [row.commentId, row._count._all])),
      mine: new Set(mine.map((row) => row.commentId)),
    };
  }

  private async likeState(
    commentId: string,
    userId: string,
    likedByMe: boolean,
  ) {
    const engagement = await this.engagement([commentId], userId);
    return {
      commentId,
      likesCount: engagement.counts.get(commentId) ?? 0,
      likedByMe,
    };
  }

  private serialize(
    comment: CommentRow,
    engagement: { counts: Map<string, number>; mine: Set<string> },
    replies: PublicComment[] = [],
  ): PublicComment {
    return {
      id: comment.id,
      content: comment.isDeleted ? REMOVED_COMMENT_TEXT : comment.content,
      isEdited: comment.isEdited,
      isDeleted: comment.isDeleted,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      user: {
        id: comment.user.id,
        name: comment.user.activeCharacter?.name ?? null,
      },
      likesCount: engagement.counts.get(comment.id) ?? 0,
      likedByMe: engagement.mine.has(comment.id),
      replies,
    };
  }
}

function emptyEngagement() {
  return {
    counts: new Map<string, number>(),
    mine: new Set<string>(),
  };
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}
