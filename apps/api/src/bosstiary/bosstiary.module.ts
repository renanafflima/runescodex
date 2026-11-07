import { Module } from '@nestjs/common';
import { RewardsModule } from '../rewards/rewards.module';
import { BosstiaryCommentsController } from './bosstiary-comments.controller';
import { BosstiaryCommentsService } from './bosstiary-comments.service';
import { BosstiaryController } from './bosstiary.controller';
import { BosstiaryService } from './bosstiary.service';
import { CommunityRotationCommentsService } from './community-rotation-comments.service';
import { CommunityRotationsController } from './community-rotations.controller';
import { CommunityRotationsService } from './community-rotations.service';

@Module({
  imports: [RewardsModule],
  controllers: [
    BosstiaryController,
    BosstiaryCommentsController,
    CommunityRotationsController,
  ],
  providers: [
    BosstiaryService,
    BosstiaryCommentsService,
    CommunityRotationsService,
    CommunityRotationCommentsService,
  ],
})
export class BosstiaryModule {}
