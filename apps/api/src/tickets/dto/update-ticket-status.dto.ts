import {
  IsEnum,
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
}
