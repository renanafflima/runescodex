import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  BosstiaryActivityKind,
  BosstiaryVisibility,
} from '../../../generated/prisma/client.js';

export const PROGRESS_NOTE_MAX = 2000;
export const PROGRESS_NAME_MAX = 120;

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

function trimOptional(value: unknown) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

export class CreateProgressActivityDto {
  @IsEnum(BosstiaryActivityKind)
  kind!: BosstiaryActivityKind;

  @IsOptional()
  @IsUUID()
  bossId?: string;

  @IsOptional()
  @Transform(({ value }) => trimOptional(value))
  @IsString()
  @MinLength(2)
  @MaxLength(96)
  slug?: string;

  @IsOptional()
  @Transform(({ value }) => trimOptional(value))
  @IsString()
  @MinLength(2)
  @MaxLength(PROGRESS_NAME_MAX)
  bossName?: string;

  @IsOptional()
  @IsUUID()
  rotationId?: string;

  @IsOptional()
  @IsUUID()
  partyId?: string;

  @IsOptional()
  @IsUUID()
  huntSessionId?: string;

  @IsOptional()
  @Transform(({ value }) => trimOptional(value))
  @IsString()
  @MaxLength(PROGRESS_NAME_MAX)
  itemName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9999)
  itemQuantity?: number;

  @IsOptional()
  @Transform(({ value }) => trimOptional(value))
  @IsString()
  @MaxLength(PROGRESS_NOTE_MAX)
  note?: string;

  @IsOptional()
  @IsEnum(BosstiaryVisibility)
  visibility?: BosstiaryVisibility;

  @IsDateString()
  occurredAt!: string;
}

export class UpdateProgressActivityDto {
  @IsOptional()
  @IsUUID()
  bossId?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(2)
  @MaxLength(PROGRESS_NAME_MAX)
  bossName?: string;

  @IsOptional()
  @IsUUID()
  rotationId?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimOptional(value))
  @IsString()
  @MaxLength(PROGRESS_NAME_MAX)
  itemName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9999)
  itemQuantity?: number;

  @IsOptional()
  @Transform(({ value }) => trimOptional(value))
  @IsString()
  @MaxLength(PROGRESS_NOTE_MAX)
  note?: string | null;

  @IsOptional()
  @IsEnum(BosstiaryVisibility)
  visibility?: BosstiaryVisibility;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}

export class ListProgressActivitiesQueryDto {
  @IsOptional()
  @IsEnum(BosstiaryActivityKind)
  kind?: BosstiaryActivityKind;

  @IsOptional()
  @IsUUID()
  bossId?: string;

  @IsOptional()
  @Transform(({ value }) => trimOptional(value))
  @IsString()
  @MaxLength(80)
  search?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class ListProgressChecklistQueryDto {
  @IsOptional()
  @Transform(({ value }) => trimOptional(value))
  @IsString()
  @MaxLength(80)
  search?: string;

  @IsOptional()
  @IsIn(['ALL', 'DONE', 'PENDING'])
  filter?: 'ALL' | 'DONE' | 'PENDING';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class UpdateProgressChecklistDto {
  @IsBoolean()
  defeated!: boolean;
}
