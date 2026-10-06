import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { HuntUpdateRequestStatus } from '../../../generated/prisma/client.js';

export const ADMIN_HUNT_UPDATE_RESPONSE_MAX_LENGTH = 1000;

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class UpdateAdminHuntUpdateRequestDto {
  @IsOptional()
  @IsEnum(HuntUpdateRequestStatus)
  status?: HuntUpdateRequestStatus;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(ADMIN_HUNT_UPDATE_RESPONSE_MAX_LENGTH)
  adminResponse?: string;
}
