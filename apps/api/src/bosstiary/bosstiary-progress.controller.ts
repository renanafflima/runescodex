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
import { RATE_LIMITS } from '../common/rate-limit.config';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { BosstiaryProgressService } from './bosstiary-progress.service';
import {
  CreateProgressActivityDto,
  ListProgressActivitiesQueryDto,
  ListProgressChecklistQueryDto,
  UpdateProgressActivityDto,
  UpdateProgressChecklistDto,
} from './dto/create-progress-activity.dto';

@Controller('bosstiary/progress')
@UseGuards(JwtAuthGuard, PremiumGuard)
export class BosstiaryProgressController {
  constructor(private readonly progress: BosstiaryProgressService) {}

  @Get('summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.progress.summary(user.userId);
  }

  @Get('rotations')
  rotations(@CurrentUser() user: AuthUser) {
    return this.progress.myRotations(user.userId);
  }

  @Get('activities')
  listActivities(
    @CurrentUser() user: AuthUser,
    @Query() query: ListProgressActivitiesQueryDto,
  ) {
    return this.progress.listActivities(user.userId, query);
  }

  @Post('activities')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.bosstiaryProgressWrite, scope: 'user' })
  createActivity(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateProgressActivityDto,
  ) {
    return this.progress.createActivity(user.userId, dto);
  }

  @Patch('activities/:id')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.bosstiaryProgressWrite, scope: 'user' })
  updateActivity(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProgressActivityDto,
  ) {
    return this.progress.updateActivity(user.userId, id, dto);
  }

  @Delete('activities/:id')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.bosstiaryProgressWrite, scope: 'user' })
  removeActivity(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.progress.removeActivity(user.userId, id);
  }

  @Get('checklist')
  listChecklist(
    @CurrentUser() user: AuthUser,
    @Query() query: ListProgressChecklistQueryDto,
  ) {
    return this.progress.listChecklist(user.userId, query);
  }

  @Patch('checklist/:bossId')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.bosstiaryProgressWrite, scope: 'user' })
  updateChecklist(
    @CurrentUser() user: AuthUser,
    @Param('bossId', ParseUUIDPipe) bossId: string,
    @Body() dto: UpdateProgressChecklistDto,
  ) {
    return this.progress.updateChecklist(user.userId, bossId, dto.defeated);
  }
}
