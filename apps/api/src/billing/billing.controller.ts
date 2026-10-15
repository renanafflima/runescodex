import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RATE_LIMITS } from '../common/rate-limit.config';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { BillingCheckoutService } from './billing-checkout.service';
import { RevenueCatBillingService } from './revenuecat-billing.service';
import { StartCheckoutDto } from './dto/start-checkout.dto';

function readDataId(request: Request) {
  const query = request.query as Record<string, unknown>;
  const direct = query['data.id'];
  if (typeof direct === 'string' && direct.trim()) {
    return direct.trim();
  }
  const nested = query.data;
  if (nested && typeof nested === 'object' && 'id' in nested) {
    const id = (nested as { id?: unknown }).id;
    if (typeof id === 'string' && id.trim()) {
      return id.trim();
    }
    if (typeof id === 'number' && Number.isFinite(id)) {
      return String(id);
    }
  }
  return undefined;
}

@Controller('billing')
export class BillingController {
  constructor(
    private readonly checkout: BillingCheckoutService,
    private readonly revenueCat: RevenueCatBillingService,
  ) {}

  @Post('checkout')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.checkout, scope: 'user' })
  start(@CurrentUser() user: AuthUser, @Body() dto: StartCheckoutDto) {
    return this.checkout.start(user.userId, dto);
  }

  @Post('checkout/refresh')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.checkout, scope: 'user' })
  refresh(@CurrentUser() user: AuthUser, @Body() dto: StartCheckoutDto) {
    return this.checkout.refresh(user.userId, dto);
  }

  @Post('revenuecat/sync')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.checkout, scope: 'user' })
  syncRevenueCat(@CurrentUser() user: AuthUser) {
    return this.revenueCat.sync(user.userId);
  }

  @Post('webhooks/revenuecat')
  @HttpCode(200)
  @UseGuards(RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.billingWebhook, scope: 'ip' })
  revenueCatWebhook(
    @Req() request: Request,
    @Body() body: { event?: { app_user_id?: unknown } },
  ) {
    return this.revenueCat.handleWebhook(
      request.header('authorization') ?? undefined,
      body,
    );
  }

  @Post('webhooks/mercadopago')
  @HttpCode(200)
  @UseGuards(RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.billingWebhook, scope: 'ip' })
  webhook(@Req() request: Request) {
    return this.checkout.handleWebhook({
      signature: request.header('x-signature') ?? undefined,
      requestId: request.header('x-request-id') ?? undefined,
      dataId: readDataId(request),
    });
  }
}
