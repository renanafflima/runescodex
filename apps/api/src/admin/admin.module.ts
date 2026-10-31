import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TicketsModule } from '../tickets/tickets.module';
import { AdminAuditController } from './admin-audit.controller';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminGuard } from './admin.guard';
import { AdminPageAccess } from './admin-page.access';
import { AdminInsightsController } from './insights/admin-insights.controller';
import { AdminInsightsService } from './insights/admin-insights.service';
import { HuntUpdateRequestsAdminController } from './hunt-update-requests-admin.controller';
import { HuntUpdateRequestsAdminService } from './hunt-update-requests-admin.service';
import { RewardsAdminController } from './rewards-admin.controller';
import { RewardsAdminService } from './rewards-admin.service';
import { AdminSettingsController } from './settings/admin-settings.controller';
import { AdminSettingsService } from './settings/admin-settings.service';
import { ReferralsModule } from '../referrals/referrals.module';
import { AdminReferralsController } from '../referrals/admin-referrals.controller';
import { AdminLicensesController } from './licenses/admin-licenses.controller';
import { AdminLicensesService } from './licenses/admin-licenses.service';
import { AdminTicketsController } from './tickets/admin-tickets.controller';
import { AdminTicketsService } from './tickets/admin-tickets.service';
import { AdminMercadoPagoDiagnosticController } from './billing/admin-mercado-pago-diagnostic.controller';
import { AdminMercadoPagoDiagnosticService } from './billing/admin-mercado-pago-diagnostic.service';

@Module({
  imports: [AuthModule, TicketsModule, ReferralsModule],
  controllers: [
    AdminDashboardController,
    RewardsAdminController,
    HuntUpdateRequestsAdminController,
    AdminInsightsController,
    AdminTicketsController,
    AdminSettingsController,
    AdminAuditController,
    AdminLicensesController,
    AdminReferralsController,
    AdminMercadoPagoDiagnosticController,
  ],
  providers: [
    AdminGuard,
    AdminPageAccess,
    RewardsAdminService,
    HuntUpdateRequestsAdminService,
    AdminInsightsService,
    AdminSettingsService,
    AdminTicketsService,
    AdminLicensesService,
    AdminMercadoPagoDiagnosticService,
  ],
})
export class AdminModule {}
