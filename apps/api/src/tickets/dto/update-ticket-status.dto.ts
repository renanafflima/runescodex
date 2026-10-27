import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TicketStatus } from '../../../generated/prisma/client.js';

export class UpdateTicketStatusDto {
  @IsEnum(TicketStatus)
  status: TicketStatus;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  resolutionNote?: string;

  /** When sent, the update fails if another staff member changed the ticket. */
  @IsOptional()
  @IsISO8601()
  expectedUpdatedAt?: string;
}
