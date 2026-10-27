import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UpdateTicketStatusDto } from '../../tickets/dto/update-ticket-status.dto';
import { AdminGuard } from '../admin.guard';
import {
  ApplyAdminTicketCorrectionDto,
  AssignAdminTicketDto,
  CreateAdminTicketMessageDto,
  ListAdminTicketsQueryDto,
  ReopenAdminTicketDto,
  UpdateAdminTicketPriorityDto,
} from './admin-tickets.dto';
import { AdminTicketsService } from './admin-tickets.service';

@Controller('admin/tickets')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminTicketsController {
  constructor(private readonly tickets: AdminTicketsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListAdminTicketsQueryDto,
  ) {
    return this.tickets.list(user.userId, query);
  }

  @Get('staff')
  staff() {
    return this.tickets.staff();
  }

  @Get('summary')
  summary() {
    return this.tickets.summary();
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.tickets.detail(id);
  }

  @Post(':id/messages')
  message(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateAdminTicketMessageDto,
  ) {
    return this.tickets.addMessage(user.userId, id, dto);
  }

  @Patch(':id/assignment')
  assign(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignAdminTicketDto,
  ) {
    return this.tickets.assign(user.userId, id, dto);
  }

  @Patch(':id/priority')
  priority(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminTicketPriorityDto,
  ) {
    return this.tickets.priority(user.userId, id, dto);
  }

  @Patch(':id/status')
  status(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketStatusDto,
  ) {
    return this.tickets.changeStatus(user.userId, id, dto);
  }

  @Post(':id/reopen')
  reopen(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReopenAdminTicketDto,
  ) {
    return this.tickets.reopen(user.userId, id, dto.reason);
  }

  @Post(':id/apply-correction')
  apply(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApplyAdminTicketCorrectionDto,
  ) {
    return this.tickets.applyCorrection(user.userId, id, dto);
  }
}
