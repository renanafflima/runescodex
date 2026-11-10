import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
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
import { PremiumGuard, SkipPremium } from '../billing/premium.guard';
import { PageQueryDto } from '../common/dto/page-query.dto';
import { RATE_LIMITS } from '../common/rate-limit.config';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { CharmGuideCommentsService } from './charm-guide-comments.service';
import { CharmGuidesService } from './charm-guides.service';
import {
  CreateCharmGuideCommentDto,
  UpdateCharmGuideCommentDto,
} from './dto/create-charm-guide-comment.dto';
import { CreateCharmGuideDto } from './dto/create-charm-guide.dto';
import { ListCharmGuidesQueryDto } from './dto/list-charm-guides-query.dto';
import { UpdateCharmGuideDto } from './dto/update-charm-guide.dto';
import { UpdateCharmGuideProgressDto } from './dto/update-charm-guide-progress.dto';

/**
 * Acesso (JWT obrigatório em todas as rotas):
 * - Autenticado: listar/ver guias, ler comentários, progresso de leitura, curtir, favoritar, comentar (@SkipPremium).
 * - Premium: criar, editar, arquivar, publicar guia e marcar progresso do plano pessoal (PATCH progress).
 */
@Controller('charm-guides')
@UseGuards(JwtAuthGuard, PremiumGuard)
export class CharmGuidesController {
  constructor(
    private readonly guides: CharmGuidesService,
    private readonly comments: CharmGuideCommentsService,
  ) {}

  @Get('categories/summary')
  @SkipPremium()
  categorySummary() {
    return this.guides.categorySummary();
  }

  @Get()
  @SkipPremium()
  list(@Query() query: ListCharmGuidesQueryDto, @CurrentUser() user: AuthUser) {
    return this.guides.list(query, user.userId);
  }

  @Get(':id')
  @SkipPremium()
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Query('characterId') characterId?: string,
  ) {
    return this.guides.findOne(id, user.userId, characterId);
  }

  @Post()
  @UseGuards(RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.charmGuideWrite, scope: 'user' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCharmGuideDto) {
    return this.guides.create(user.userId, dto);
  }

  @Patch(':id')
  @UseGuards(RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.charmGuideWrite, scope: 'user' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCharmGuideDto,
  ) {
    return this.guides.update(user.userId, id, dto);
  }

  @Delete(':id')
  @UseGuards(RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.charmGuideWrite, scope: 'user' })
  archive(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.guides.archive(user.userId, id);
  }

  @Post(':id/submit')
  @UseGuards(RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.charmGuideWrite, scope: 'user' })
  submit(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.guides.submit(user.userId, id, idempotencyKey);
  }

  @Post(':id/like')
  @SkipPremium()
  @UseGuards(RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.charmGuideWrite, scope: 'user' })
  like(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.guides.like(user.userId, id);
  }

  @Delete(':id/like')
  @SkipPremium()
  @UseGuards(RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.charmGuideWrite, scope: 'user' })
  unlike(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.guides.unlike(user.userId, id);
  }

  @Post(':id/favorite')
  @SkipPremium()
  @UseGuards(RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.charmGuideWrite, scope: 'user' })
  favorite(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.guides.favorite(user.userId, id);
  }

  @Delete(':id/favorite')
  @SkipPremium()
  @UseGuards(RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.charmGuideWrite, scope: 'user' })
  unfavorite(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.guides.unfavorite(user.userId, id);
  }

  @Get(':id/progress')
  @SkipPremium()
  progress(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('characterId', ParseUUIDPipe) characterId: string,
  ) {
    return this.guides.progressSummary(id, characterId);
  }

  @Patch(':id/progress')
  @UseGuards(RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.charmGuideWrite, scope: 'user' })
  updateProgress(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCharmGuideProgressDto,
  ) {
    return this.guides.updateProgress(user.userId, id, dto);
  }

  @Get(':id/comments')
  @SkipPremium()
  listComments(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PageQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.comments.list(id, query, user.userId);
  }

  @Post(':id/comments')
  @SkipPremium()
  @UseGuards(RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.charmGuideWrite, scope: 'user' })
  createComment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCharmGuideCommentDto,
  ) {
    return this.comments.create(id, user.userId, dto);
  }

  @Patch(':id/comments/:commentId')
  @SkipPremium()
  @UseGuards(RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.charmGuideWrite, scope: 'user' })
  updateComment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() dto: UpdateCharmGuideCommentDto,
  ) {
    return this.comments.update(id, commentId, user.userId, dto);
  }

  @Delete(':id/comments/:commentId')
  @SkipPremium()
  @UseGuards(RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.charmGuideWrite, scope: 'user' })
  removeComment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ) {
    return this.comments.remove(id, commentId, user.userId);
  }

  @Post(':id/comments/:commentId/like')
  @SkipPremium()
  @UseGuards(RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.charmGuideWrite, scope: 'user' })
  likeComment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ) {
    return this.comments.like(id, commentId, user.userId);
  }

  @Delete(':id/comments/:commentId/like')
  @SkipPremium()
  @UseGuards(RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.charmGuideWrite, scope: 'user' })
  unlikeComment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ) {
    return this.comments.unlike(id, commentId, user.userId);
  }
}
