/**
 * TEMPORARY: admin-only production database/migration diagnostic.
 * Remove this controller, its service, and GET /admin/system/database-migration-diagnostic
 * after the production migration audit.
 */
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../admin.guard';
import { AdminDatabaseMigrationDiagnosticService } from './admin-database-migration-diagnostic.service';

@Controller('admin/system')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminDatabaseMigrationDiagnosticController {
  constructor(
    private readonly diagnostic: AdminDatabaseMigrationDiagnosticService,
  ) {}

  @Get('database-migration-diagnostic')
  databaseMigrationDiagnostic() {
    return this.diagnostic.run();
  }
}
