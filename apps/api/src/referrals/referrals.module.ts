import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccountReferralsController } from './account-referrals.controller';
import { ReferralService } from './referral.service';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [AccountReferralsController],
  providers: [ReferralService],
  exports: [ReferralService],
})
export class ReferralsModule {}
