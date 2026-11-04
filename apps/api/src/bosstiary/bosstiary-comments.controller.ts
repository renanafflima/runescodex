import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PremiumGuard } from '../billing/premium.guard';
import { CatalogSlugPipe } from '../common/catalog-slug.pipe';
import { PageQueryDto } from '../common/dto/page-query.dto';
import { RATE_LIMITS } from '../common/rate-limit.config';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { BosstiaryCommentsService } from './bosstiary-comments.service';
import { CreateBosstiaryCommentDto } from './dto/create-bosstiary-comment.dto';
import { UpdateBosstiaryCommentDto } from './dto/update-bosstiary-comment.dto';

@Controller('bosstiary')
@UseGuards(JwtAuthGuard, PremiumGuard)
export class BosstiaryCommentsController {
  constructor(private readonly comments: BosstiaryCommentsService) {}

  @Get(':slug/comments')
  list(
    @Param('slug', CatalogSlugPipe) slug: string,
    @Query() query: PageQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.comments.list(slug, query, user.userId);
  }

  @Post(':slug/comments')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.bosstiaryCommentWrite, scope: 'user' })
  create(
    @CurrentUser() user: AuthUser,
    @Param('slug', CatalogSlugPipe) slug: string,
    @Body() dto: CreateBosstiaryCommentDto,
  ) {
    return this.comments.create(slug, user.userId, dto);
  }

  @Patch(':slug/comments/:commentId')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.bosstiaryCommentWrite, scope: 'user' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('slug', CatalogSlugPipe) slug: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() dto: UpdateBosstiaryCommentDto,
  ) {
    return this.comments.update(slug, commentId, user.userId, dto);
  }

  @Delete(':slug/comments/:commentId')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.bosstiaryCommentWrite, scope: 'user' })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('slug', CatalogSlugPipe) slug: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ) {
    return this.comments.remove(slug, commentId, user.userId);
  }

  @Post(':slug/comments/:commentId/like')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.bosstiaryCommentWrite, scope: 'user' })
  like(
    @CurrentUser() user: AuthUser,
    @Param('slug', CatalogSlugPipe) slug: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ) {
    return this.comments.like(slug, commentId, user.userId);
  }

  @Delete(':slug/comments/:commentId/like')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.bosstiaryCommentWrite, scope: 'user' })
  unlike(
    @CurrentUser() user: AuthUser,
    @Param('slug', CatalogSlugPipe) slug: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ) {
    return this.comments.unlike(slug, commentId, user.userId);
  }
}
