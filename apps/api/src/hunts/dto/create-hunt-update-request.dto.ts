import { Transform } from 'class-transformer';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { HuntUpdateRequestType } from '../../../generated/prisma/client.js';

export const HUNT_UPDATE_REQUEST_MIN_LENGTH = 5;
export const HUNT_UPDATE_REQUEST_MAX_LENGTH = 1000;

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateHuntUpdateRequestDto {
  @IsEnum(HuntUpdateRequestType)
  type: HuntUpdateRequestType;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(HUNT_UPDATE_REQUEST_MIN_LENGTH)
  @MaxLength(HUNT_UPDATE_REQUEST_MAX_LENGTH)
  description: string;
}
