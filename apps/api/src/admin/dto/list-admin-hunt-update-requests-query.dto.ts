import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  HuntUpdateRequestStatus,
  HuntUpdateRequestType,
} from '../../../generated/prisma/client.js';
import { PageQueryDto } from '../../common/dto/page-query.dto';

function emptyToUndefined(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class ListAdminHuntUpdateRequestsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(HuntUpdateRequestStatus)
  status?: HuntUpdateRequestStatus;

  @IsOptional()
  @IsEnum(HuntUpdateRequestType)
  type?: HuntUpdateRequestType;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  @MaxLength(80)
  search?: string;
}
