import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AdminGuard } from '../admin/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RATE_LIMITS } from '../common/rate-limit.config';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { TicketEvidenceFileInterceptor } from './ticket-evidence-file.interceptor';
import { TicketsService, type TicketEvidenceUpload } from './tickets.service';

@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @UseGuards(RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.ticketWrite, scope: 'user' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTicketDto) {
    return this.ticketsService.create(user.userId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: ListTicketsQueryDto) {
    return this.ticketsService.findAll(user.userId, query);
  }

  @Post(':id/evidence')
  @UseGuards(RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.ticketWrite, scope: 'user' })
  @UseInterceptors(TicketEvidenceFileInterceptor)
  addEvidence(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: TicketEvidenceUpload | undefined,
    @Body('source') source?: string,
  ) {
    return this.ticketsService.addEvidence(user.userId, id, { file, source });
  }

  @Get(':id/evidence/:evidenceId')
  async readEvidence(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
  ) {
    const evidence = await this.ticketsService.readEvidence(
      user.userId,
      id,
      evidenceId,
    );
    return new StreamableFile(evidence.body, {
      type: evidence.mimeType,
      disposition: `inline; filename="${evidence.filename}"`,
      length: evidence.body.length,
    });
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ticketsService.findById(user.userId, id);
  }

  @Patch(':id/status')
  @UseGuards(AdminGuard)
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketStatusDto,
  ) {
    return this.ticketsService.updateStatus(user.userId, id, dto);
  }
}
