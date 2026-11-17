import { Module } from '@nestjs/common';
import { AdminCharmGuidesController } from '../admin/charm-guides/admin-charm-guides.controller';
import { AdminGuard } from '../admin/admin.guard';
import { RewardsModule } from '../rewards/rewards.module';
import { CharmGuideCommentsService } from './charm-guide-comments.service';
import { CharmGuidesController } from './charm-guides.controller';
import { CharmGuidesService } from './charm-guides.service';

@Module({
  imports: [RewardsModule],
  controllers: [CharmGuidesController, AdminCharmGuidesController],
  providers: [CharmGuidesService, CharmGuideCommentsService, AdminGuard],
  exports: [CharmGuidesService],
})
export class CharmGuidesModule {}
