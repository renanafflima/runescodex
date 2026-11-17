import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PremiumGuard } from '../billing/premium.guard';
import { RATE_LIMITS } from '../common/rate-limit.config';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { AdMobRewardedService } from './admob-rewarded.service';

function queryStringFromRequest(request: Request) {
  const source = request.originalUrl || request.url;
  const index = source.indexOf('?');
  return index === -1 ? '' : source.slice(index + 1);
}

@Controller('ads/admob')
export class AdMobRewardedController {
  constructor(private readonly rewarded: AdMobRewardedService) {}

  @Get('ssv')
  @HttpCode(200)
  @UseGuards(RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.admobSsv, scope: 'ip' })
  async ssv(@Req() request: Request) {
    const result = await this.rewarded.handleSsvCallback(
      queryStringFromRequest(request),
    );
    return result;
  }

  @Post('rewarded/prepare')
  @UseGuards(JwtAuthGuard, PremiumGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.admobRewardedPrepare, scope: 'user' })
  prepare(@CurrentUser() user: AuthUser) {
    return this.rewarded.prepareSession(user.userId);
  }

  @Get('rewarded/sessions/:sessionId')
  @UseGuards(JwtAuthGuard, PremiumGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.admobRewardedStatus, scope: 'user' })
  sessionStatus(
    @CurrentUser() user: AuthUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.rewarded.getSessionStatus(user.userId, sessionId);
  }
}
