import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../admin.guard';
import { ReconcileCheckoutAttemptDto } from './admin-checkout-attempt.dto';
import { AdminCheckoutAttemptService } from './admin-checkout-attempt.service';

@Controller('admin/billing/checkout-attempts')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminCheckoutAttemptController {
  constructor(private readonly attempts: AdminCheckoutAttemptService) {}

  @Get(':id')
  inspect(@Param('id', ParseUUIDPipe) id: string) {
    return this.attempts.inspect(id);
  }

  @Post(':id/reconcile')
  reconcile(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReconcileCheckoutAttemptDto,
  ) {
    return this.attempts.reconcile(user.userId, id, dto);
  }
}
