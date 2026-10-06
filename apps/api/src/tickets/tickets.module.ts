import { Module } from '@nestjs/common';
import { AdminGuard } from '../admin/admin.guard';
import { createTicketStorage } from './storage/ticket-storage';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import {
  TICKET_EVIDENCE_MAX_BYTES,
  TICKET_STORAGE,
  ticketEvidenceMaxBytes,
} from './tickets.constants';

@Module({
  controllers: [TicketsController],
  providers: [
    TicketsService,
    AdminGuard,
    {
      provide: TICKET_STORAGE,
      useFactory: () => createTicketStorage(process.env),
    },
    {
      provide: TICKET_EVIDENCE_MAX_BYTES,
      useFactory: () => ticketEvidenceMaxBytes(process.env),
    },
  ],
})
export class TicketsModule {}
