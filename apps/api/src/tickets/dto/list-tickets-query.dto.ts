import { IsEnum, IsOptional } from 'class-validator';
import { TicketStatus } from '../../../generated/prisma/client.js';
import { PageQueryDto } from '../../common/dto/page-query.dto';

export class ListTicketsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;
}
