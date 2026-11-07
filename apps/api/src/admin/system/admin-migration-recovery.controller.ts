/**
 * TEMPORARY: admin-only migration recovery without Render Shell.
 * Remove this controller after production Prisma history is regularized.
 */
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../admin.guard';
import { ExecuteMigrationRecoveryStepDto } from './admin-migration-recovery.dto';
import { AdminMigrationRecoveryService } from './admin-migration-recovery.service';

@Controller('admin/system/migration-recovery')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminMigrationRecoveryController {
  constructor(private readonly recovery: AdminMigrationRecoveryService) {}

  @Get('diagnostic')
  migrationRecoveryDiagnostic() {
    return this.recovery.diagnostic();
  }

  @Post('execute')
  migrationRecoveryExecute(@Body() body: ExecuteMigrationRecoveryStepDto) {
    return this.recovery.executeStep(body.step);
  }
}
