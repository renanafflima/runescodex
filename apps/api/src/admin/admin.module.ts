import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminGuard } from './admin.guard';
import { AdminPageAccess } from './admin-page.access';
import { HuntUpdateRequestsAdminController } from './hunt-update-requests-admin.controller';
import { HuntUpdateRequestsAdminService } from './hunt-update-requests-admin.service';
import { RewardsAdminController } from './rewards-admin.controller';
import { RewardsAdminService } from './rewards-admin.service';

@Module({
  imports: [AuthModule],
  controllers: [
    AdminDashboardController,
    RewardsAdminController,
    HuntUpdateRequestsAdminController,
  ],
  providers: [
    AdminGuard,
    AdminPageAccess,
    RewardsAdminService,
    HuntUpdateRequestsAdminService,
  ],
})
export class AdminModule {}
