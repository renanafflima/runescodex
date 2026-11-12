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
import { PremiumGuard } from '../billing/premium.guard';
import { PageQueryDto } from '../common/dto/page-query.dto';
import { RATE_LIMITS } from '../common/rate-limit.config';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { CommunityRotationCommentsService } from './community-rotation-comments.service';
import { CommunityRotationsService } from './community-rotations.service';
import { CreateCommunityRotationCommentDto } from './dto/create-community-rotation-comment.dto';
import { CreateCommunityRotationDto } from './dto/create-community-rotation.dto';
import { CreateCommunityRotationTestDto } from './dto/create-community-rotation-test.dto';
import { ListCommunityRotationsQueryDto } from './dto/list-community-rotations-query.dto';
import { UpdateCommunityRotationCommentDto } from './dto/update-community-rotation-comment.dto';
import { UpdateCommunityRotationDto } from './dto/update-community-rotation.dto';

@Controller('bosstiary/community/rotations')
@UseGuards(JwtAuthGuard, PremiumGuard)
export class CommunityRotationsController {
  constructor(
    private readonly rotations: CommunityRotationsService,
    private readonly comments: CommunityRotationCommentsService,
  ) {}

  @Get()
  list(
    @Query() query: ListCommunityRotationsQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.rotations.list(query, user.userId);
  }

  @Get('ranking')
  ranking(@Query('limit') limitRaw?: string) {
    const parsed = Number(limitRaw ?? 10);
    const limit = Number.isFinite(parsed)
      ? Math.min(Math.max(Math.trunc(parsed), 1), 50)
      : 10;
    return this.rotations.weeklyRanking(limit);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.rotations.findOne(id, user.userId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.communityRotationWrite, scope: 'user' })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCommunityRotationDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.rotations.create(user.userId, dto, idempotencyKey);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.communityRotationWrite, scope: 'user' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommunityRotationDto,
  ) {
    return this.rotations.update(id, user.userId, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.communityRotationWrite, scope: 'user' })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.rotations.remove(id, user.userId);
  }

  @Post(':id/like')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.communityRotationSocial, scope: 'user' })
  like(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.rotations.like(id, user.userId);
  }

  @Delete(':id/like')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.communityRotationSocial, scope: 'user' })
  unlike(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.rotations.unlike(id, user.userId);
  }

  @Post(':id/favorite')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.communityRotationSocial, scope: 'user' })
  favorite(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.rotations.favorite(id, user.userId);
  }

  @Delete(':id/favorite')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.communityRotationSocial, scope: 'user' })
  unfavorite(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.rotations.unfavorite(id, user.userId);
  }

  @Get(':id/comments')
  listComments(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PageQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.comments.list(id, query, user.userId);
  }

  @Post(':id/comments')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.communityRotationSocial, scope: 'user' })
  createComment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCommunityRotationCommentDto,
  ) {
    return this.comments.create(id, user.userId, dto);
  }

  @Patch(':id/comments/:commentId')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.communityRotationSocial, scope: 'user' })
  updateComment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() dto: UpdateCommunityRotationCommentDto,
  ) {
    return this.comments.update(id, commentId, user.userId, dto);
  }

  @Delete(':id/comments/:commentId')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.communityRotationSocial, scope: 'user' })
  removeComment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ) {
    return this.comments.remove(id, commentId, user.userId);
  }

  @Post(':id/comments/:commentId/like')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.communityRotationSocial, scope: 'user' })
  likeComment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ) {
    return this.comments.like(id, commentId, user.userId);
  }

  @Delete(':id/comments/:commentId/like')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.communityRotationSocial, scope: 'user' })
  unlikeComment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ) {
    return this.comments.unlike(id, commentId, user.userId);
  }

  @Get(':id/tests')
  listTests(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PageQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.rotations.listTests(id, query, user.userId);
  }

  @Post(':id/tests')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.communityRotationWrite, scope: 'user' })
  createTest(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCommunityRotationTestDto,
  ) {
    return this.rotations.createTest(id, user.userId, dto);
  }
}
