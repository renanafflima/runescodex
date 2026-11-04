import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Max,
  Min,
} from 'class-validator';
import {
  HuntUpdateRequestType,
  Vocation,
} from '../../../generated/prisma/client.js';

export const HUNT_UPDATE_REQUEST_MIN_LENGTH = 5;
export const HUNT_UPDATE_REQUEST_MAX_LENGTH = 1000;

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

function emptyToUndefined(value: unknown) {
  const trimmed = trimString(value);
  return typeof trimmed === 'string' && trimmed.length === 0
    ? undefined
    : trimmed;
}

export class CreateHuntUpdateRequestDto {
  @IsEnum(HuntUpdateRequestType)
  type: HuntUpdateRequestType;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(HUNT_UPDATE_REQUEST_MIN_LENGTH)
  @MaxLength(HUNT_UPDATE_REQUEST_MAX_LENGTH)
  description: string;

  @IsOptional()
  @IsEnum(Vocation)
  vocation?: Vocation;

  @Transform(({ value }) => emptyToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  proposedValue?: string;

  /** Identifies the HuntVocation level range when the hunt has several for the same vocation. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  rangeLevelMin?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  rangeLevelMax?: number;
}
