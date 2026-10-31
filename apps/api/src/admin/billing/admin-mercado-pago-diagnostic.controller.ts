/**
 * TEMPORARY: admin-only Mercado Pago Pix diagnostic.
 * Remove this controller, its service, and ENABLE_MERCADO_PAGO_ADMIN_DIAGNOSTIC after diagnosis.
 */
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../admin.guard';
import { AdminMercadoPagoDiagnosticService } from './admin-mercado-pago-diagnostic.service';

@Controller('admin/billing')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminMercadoPagoDiagnosticController {
  constructor(
    private readonly diagnostic: AdminMercadoPagoDiagnosticService,
  ) {}

  @Get('mercadopago-diagnostic')
  mercadoPagoDiagnostic() {
    return this.diagnostic.run();
  }
}
