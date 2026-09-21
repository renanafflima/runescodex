import { Module } from '@nestjs/common';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminGuard } from './admin.guard';
import { RewardsAdminController } from './rewards-admin.controller';
import { RewardsAdminService } from './rewards-admin.service';

@Module({
  controllers: [AdminDashboardController, RewardsAdminController],
  providers: [AdminGuard, RewardsAdminService],
})
export class AdminModule {}
