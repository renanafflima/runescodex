import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommunityRotationStatus } from '../../generated/prisma/client.js';
import { pageResult, resolvePage } from '../common/pagination';
import { PageQueryDto } from '../common/dto/page-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import { PUBLIC_STATUSES } from './community-rotation.constants';
import { CreateCommunityRotationCommentDto } from './dto/create-community-rotation-comment.dto';
import { UpdateCommunityRotationCommentDto } from './dto/update-community-rotation-comment.dto';

export const REMOVED_COMMUNITY_ROTATION_COMMENT_TEXT = 'Comentário removido.';

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

export type PublicCommunityRotationComment = {
  id: string;
  content: string;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  user: { id: string; name: string | null };
  likesCount: number;
  likedByMe: boolean;
  replies: PublicCommunityRotationComment[];
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
export class CommunityRotationCommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(rotationId: string, query: PageQueryDto, userId?: string) {
    await this.requireVisibleRotation(rotationId);
    const { page, limit, skip } = resolvePage(query);
    const rootWhere = { rotationId, parentId: null };
    const [total, commentCount, roots] = await Promise.all([
      this.prisma.communityRotationComment.count({ where: rootWhere }),
      this.prisma.communityRotationComment.count({ where: { rotationId } }),
      this.prisma.communityRotationComment.findMany({
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
        : await this.prisma.communityRotationComment.findMany({
            where: { rotationId, parentId: { in: rootIds } },
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
            (repliesByParent.get(comment.id) ?? []).map((row) =>
              this.serialize(row, engagement),
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

  async create(
    rotationId: string,
    userId: string,
    dto: CreateCommunityRotationCommentDto,
  ) {
    await this.requireVisibleRotation(rotationId);
    const parentId = await this.resolveParent(rotationId, dto.parentId);
    const created = await this.prisma.communityRotationComment.create({
      data: {
        rotationId,
        userId,
        parentId,
        content: dto.content,
      },
      select: COMMENT_SELECT,
    });
    return this.serialize(created, emptyEngagement());
  }

  async update(
    rotationId: string,
    commentId: string,
    userId: string,
    dto: UpdateCommunityRotationCommentDto,
  ) {
    const comment = await this.requireOwnedComment(rotationId, commentId, userId);
    if (comment.isDeleted) {
      throw new BadRequestException(
        'Não é possível editar um comentário removido.',
      );
    }
    const updated = await this.prisma.communityRotationComment.update({
      where: { id: comment.id },
      data: { content: dto.content, isEdited: true },
      select: COMMENT_SELECT,
    });
    const engagement = await this.engagement([updated.id], userId);
    return this.serialize(updated, engagement);
  }

  async remove(rotationId: string, commentId: string, userId: string) {
    const comment = await this.requireOwnedComment(rotationId, commentId, userId);
    if (comment.isDeleted) {
      throw new BadRequestException('Comentário já removido.');
    }
    const updated = await this.prisma.communityRotationComment.update({
      where: { id: comment.id },
      data: { isDeleted: true },
      select: COMMENT_SELECT,
    });
    const engagement = await this.engagement([updated.id], userId);
    return this.serialize(updated, engagement);
  }

  async like(rotationId: string, commentId: string, userId: string) {
    const comment = await this.requireComment(rotationId, commentId);
    if (comment.isDeleted) {
      throw new BadRequestException(
        'Não é possível curtir um comentário removido.',
      );
    }
    try {
      await this.prisma.communityRotationCommentLike.create({
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

  async unlike(rotationId: string, commentId: string, userId: string) {
    const comment = await this.requireComment(rotationId, commentId);
    await this.prisma.communityRotationCommentLike.deleteMany({
      where: { commentId: comment.id, userId },
    });
    return this.likeState(comment.id, userId, false);
  }

  private async requireVisibleRotation(rotationId: string) {
    const rotation = await this.prisma.communityRotation.findFirst({
      where: {
        id: rotationId,
        status: { in: PUBLIC_STATUSES },
      },
      select: { id: true },
    });
    if (!rotation) {
      throw new NotFoundException('Rotação não encontrada.');
    }
    return rotation;
  }

  private async requireComment(rotationId: string, commentId: string) {
    await this.requireVisibleRotation(rotationId);
    const comment = await this.prisma.communityRotationComment.findFirst({
      where: { id: commentId, rotationId },
      select: {
        id: true,
        rotationId: true,
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
    rotationId: string,
    commentId: string,
    userId: string,
  ) {
    const comment = await this.requireComment(rotationId, commentId);
    if (comment.userId !== userId) {
      throw new ForbiddenException('Você não pode alterar este comentário.');
    }
    return comment;
  }

  private async resolveParent(rotationId: string, parentId?: string) {
    if (!parentId) {
      return null;
    }
    const parent = await this.prisma.communityRotationComment.findFirst({
      where: { id: parentId },
      select: { id: true, rotationId: true, parentId: true, isDeleted: true },
    });
    if (!parent) {
      throw new NotFoundException('Comentário não encontrado.');
    }
    if (parent.rotationId !== rotationId) {
      throw new BadRequestException(
        'A resposta precisa pertencer à mesma rotação.',
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
      ? this.prisma.communityRotationCommentLike.findMany({
          where: { userId, commentId: { in: commentIds } },
          select: { commentId: true },
        })
      : Promise.resolve([]);
    const [counts, mine] = await Promise.all([
      this.prisma.communityRotationCommentLike.groupBy({
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
    replies: PublicCommunityRotationComment[] = [],
  ): PublicCommunityRotationComment {
    return {
      id: comment.id,
      content: comment.isDeleted
        ? REMOVED_COMMUNITY_ROTATION_COMMENT_TEXT
        : comment.content,
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
