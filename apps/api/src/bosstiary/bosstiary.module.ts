import { Module } from '@nestjs/common';
import { RewardsModule } from '../rewards/rewards.module';
import { BosstiaryCommentsController } from './bosstiary-comments.controller';
import { BosstiaryCommentsService } from './bosstiary-comments.service';
import { BosstiaryController } from './bosstiary.controller';
import { BosstiaryService } from './bosstiary.service';
import { BosstiaryProgressController } from './bosstiary-progress.controller';
import { BosstiaryProgressService } from './bosstiary-progress.service';
import { CommunityRotationCommentsService } from './community-rotation-comments.service';
import { CommunityRotationsController } from './community-rotations.controller';
import { CommunityRotationsService } from './community-rotations.service';
import { HuntSessionService } from './hunt-session.service';
import { PartyController } from './party.controller';
import { PartyNotificationsService } from './party-notifications.service';
import { PartyService } from './party.service';

@Module({
  imports: [RewardsModule],
  controllers: [
    BosstiaryController,
    BosstiaryCommentsController,
    CommunityRotationsController,
    BosstiaryProgressController,
    PartyController,
  ],
  providers: [
    BosstiaryService,
    BosstiaryCommentsService,
    CommunityRotationsService,
    CommunityRotationCommentsService,
    BosstiaryProgressService,
    PartyNotificationsService,
    PartyService,
    HuntSessionService,
  ],
  exports: [PartyService],
})
export class BosstiaryModule {}
