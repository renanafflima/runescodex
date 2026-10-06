import { Module } from '@nestjs/common';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminGuard } from './admin.guard';
import { HuntUpdateRequestsAdminController } from './hunt-update-requests-admin.controller';
import { HuntUpdateRequestsAdminService } from './hunt-update-requests-admin.service';
import { RewardsAdminController } from './rewards-admin.controller';
import { RewardsAdminService } from './rewards-admin.service';

@Module({
  controllers: [
    AdminDashboardController,
    RewardsAdminController,
    HuntUpdateRequestsAdminController,
  ],
  providers: [AdminGuard, RewardsAdminService, HuntUpdateRequestsAdminService],
})
export class AdminModule {}
