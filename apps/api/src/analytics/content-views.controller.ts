import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsEnum, IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { ContentSubject } from '../../generated/prisma/client.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RATE_LIMITS } from '../common/rate-limit.config';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { ContentViewsService } from './content-views.service';

class RecordContentViewDto {
  @IsEnum(ContentSubject)
  subject!: ContentSubject;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  subjectId!: string;

  @IsString()
  @MinLength(36)
  @MaxLength(36)
  sessionKey!: string;
}

class RecordSearchMissDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  term!: string;

  @IsIn(['HUNT_CLIENT'])
  category!: 'HUNT_CLIENT';
}

@Controller('analytics')
@UseGuards(OptionalJwtAuthGuard, RateLimitGuard)
export class ContentViewsController {
  constructor(private readonly views: ContentViewsService) {}

  @Post('views')
  @RateLimit({ ...RATE_LIMITS.analyticsWrite, scope: 'user' })
  record(
    @CurrentUser() user: AuthUser | null,
    @Body() dto: RecordContentViewDto,
  ) {
    return this.views.record({
      subject: dto.subject,
      subjectId: dto.subjectId,
      sessionKey: dto.sessionKey,
      userId: user?.userId,
    });
  }

  @Post('search-misses')
  @RateLimit({ ...RATE_LIMITS.analyticsWrite, scope: 'user' })
  searchMiss(@Body() dto: RecordSearchMissDto) {
    return this.views.recordSearchMiss(dto.term, dto.category);
  }
}
