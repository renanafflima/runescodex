import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { PageQueryDto } from '../common/dto/page-query.dto';
import { ReferralService } from './referral.service';

@Controller('account/referrals')
@UseGuards(JwtAuthGuard)
export class AccountReferralsController {
  constructor(private readonly referrals: ReferralService) {}

  @Get()
  view(@CurrentUser() user: AuthUser, @Query() query: PageQueryDto) {
    return this.referrals.accountView(user.userId, query);
  }
}
