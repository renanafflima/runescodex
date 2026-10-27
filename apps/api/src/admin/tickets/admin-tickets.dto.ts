import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  TicketMessageVisibility,
  TicketPriority,
  TicketProblemType,
  TicketStatus,
} from '../../../generated/prisma/client.js';
import { PageQueryDto } from '../../common/dto/page-query.dto';

function emptyToUndefined(value: unknown) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class ListAdminTicketsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsEnum(TicketProblemType)
  problemType?: TicketProblemType;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn(['me', 'unassigned'])
  assignee?: 'me' | 'unassigned';

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsUUID()
  huntId?: string;

  @IsOptional()
  @IsUUID()
  creatureId?: string;

  @IsOptional()
  @IsUUID()
  authorId?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  @MaxLength(80)
  search?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  @MaxLength(80)
  author?: string;

  @IsOptional()
  @IsIn(['createdAt', 'updatedAt'])
  dateField?: 'createdAt' | 'updatedAt';

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsIn(['updatedAt', 'createdAt', 'priority'])
  sort?: 'updatedAt' | 'createdAt' | 'priority';
}

export class CreateAdminTicketMessageDto {
  @IsEnum(TicketMessageVisibility)
  visibility!: TicketMessageVisibility;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;

  @IsISO8601()
  expectedUpdatedAt!: string;
}

export class AssignAdminTicketDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  assigneeId!: string | null;

  @IsISO8601()
  expectedUpdatedAt!: string;
}

export class UpdateAdminTicketPriorityDto {
  @IsEnum(TicketPriority)
  priority!: TicketPriority;

  @ValidateIf((dto: UpdateAdminTicketPriorityDto) => dto.priority === 'URGENT')
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  urgentReason?: string;

  @IsISO8601()
  expectedUpdatedAt!: string;
}

export class ApplyAdminTicketCorrectionDto {
  @IsISO8601()
  expectedUpdatedAt!: string;
}

export class ReopenAdminTicketDto {
  @IsString()
  @MinLength(3)
  @MaxLength(5000)
  reason!: string;
}
