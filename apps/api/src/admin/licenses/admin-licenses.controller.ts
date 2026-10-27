import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../admin.guard';
import { PendingLicenseGrantService } from '../../billing/pending-license-grant.service';
import {
  CreateVoucherDto,
  ExtendLicenseDto,
  GrantLicenseDto,
  LicenseReasonDto,
  ListGrantsQueryDto,
  ListLicensesQueryDto,
  ListPaymentsQueryDto,
  ListPendingGrantsQueryDto,
  ListVouchersQueryDto,
  SchedulePendingGrantDto,
  SearchLicenseUsersQueryDto,
} from './admin-licenses.dto';
import { AdminLicensesService } from './admin-licenses.service';

@Controller('admin/licenses')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminLicensesController {
  constructor(
    private readonly licenses: AdminLicensesService,
    private readonly pendingGrants: PendingLicenseGrantService,
  ) {}

  @Get('overview')
  overview() {
    return this.licenses.overview();
  }

  @Get('users')
  users(@Query() query: SearchLicenseUsersQueryDto) {
    return this.licenses.searchUsers(query.search);
  }

  @Get('payments')
  payments(@Query() query: ListPaymentsQueryDto) {
    return this.licenses.listPayments(query);
  }

  @Get('payments/:id')
  payment(@Param('id', ParseUUIDPipe) id: string) {
    return this.licenses.paymentDetail(id);
  }

  @Post('payments/:id/sync')
  syncPayment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.licenses.syncPayment(user.userId, id);
  }

  @Get('vouchers')
  vouchers(@Query() query: ListVouchersQueryDto) {
    return this.licenses.listVouchers(query);
  }

  @Post('vouchers')
  createVoucher(@CurrentUser() user: AuthUser, @Body() dto: CreateVoucherDto) {
    return this.licenses.createVoucher(user.userId, dto);
  }

  @Get('vouchers/:id')
  voucher(@Param('id', ParseUUIDPipe) id: string) {
    return this.licenses.voucherDetail(id);
  }

  @Post('vouchers/:id/pause')
  pauseVoucher(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.licenses.pauseVoucher(user.userId, id);
  }

  @Post('vouchers/:id/resume')
  resumeVoucher(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.licenses.resumeVoucher(user.userId, id);
  }

  @Post('vouchers/:id/close')
  closeVoucher(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.licenses.closeVoucher(user.userId, id);
  }

  @Get('grants')
  grants(@Query() query: ListGrantsQueryDto) {
    return this.licenses.listGrants(query);
  }

  @Post('grants')
  grant(@CurrentUser() user: AuthUser, @Body() dto: GrantLicenseDto) {
    return this.licenses.grant(user.userId, dto);
  }

  @Get('pending-grants')
  pendingGrantsList(@Query() query: ListPendingGrantsQueryDto) {
    return this.pendingGrants.list(query);
  }

  @Post('pending-grants')
  schedulePending(
    @CurrentUser() user: AuthUser,
    @Body() dto: SchedulePendingGrantDto,
  ) {
    return this.pendingGrants.schedule(user.userId, dto);
  }

  @Post('pending-grants/:id/cancel')
  cancelPending(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LicenseReasonDto,
  ) {
    return this.pendingGrants.cancel(user.userId, id, dto.reason);
  }

  @Get('activity')
  activity() {
    return this.licenses.activity();
  }

  @Get()
  list(@Query() query: ListLicensesQueryDto) {
    return this.licenses.list(query);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.licenses.detail(id);
  }

  @Post(':id/extend')
  extend(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExtendLicenseDto,
  ) {
    return this.licenses.extend(user.userId, id, dto);
  }

  @Post(':id/suspend')
  suspend(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LicenseReasonDto,
  ) {
    return this.licenses.suspend(user.userId, id, dto);
  }

  @Post(':id/revoke')
  revoke(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LicenseReasonDto,
  ) {
    return this.licenses.revoke(user.userId, id, dto);
  }

  @Post(':id/restore')
  restore(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LicenseReasonDto,
  ) {
    return this.licenses.restore(user.userId, id, dto);
  }
}
