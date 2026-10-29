import { IsEnum, IsIn, IsOptional } from 'class-validator';
import {
  TicketProblemType,
  TicketStatus,
} from '../../../generated/prisma/client.js';
import { PageQueryDto } from '../../common/dto/page-query.dto';

export class ListTicketsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsEnum(TicketProblemType)
  problemType?: TicketProblemType;

  /// Forces the authenticated user, including staff, to see only their own tickets.
  @IsOptional()
  @IsIn(['true'])
  mine?: 'true';
}
