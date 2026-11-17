import { Module } from '@nestjs/common';
import { RewardsModule } from '../rewards/rewards.module';
import { AdMobRewardedController } from './admob-rewarded.controller';
import { AdMobRewardedService } from './admob-rewarded.service';

@Module({
  imports: [RewardsModule],
  controllers: [AdMobRewardedController],
  providers: [AdMobRewardedService],
  exports: [AdMobRewardedService],
})
export class AdsModule {}
