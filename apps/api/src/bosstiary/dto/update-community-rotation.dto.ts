import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { BosstiaryHuntMode, Vocation } from '../../../generated/prisma/client.js';
import { CommunityRotationBossInputDto } from './community-rotation-boss-input.dto';
import {
  COMMUNITY_PLANNED_DURATIONS,
  COMMUNITY_ROTATION_TEXT_MAX,
  COMMUNITY_ROTATION_TITLE_MAX,
} from './create-community-rotation.dto';

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

function trimOptional(value: unknown) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

export class UpdateCommunityRotationDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(3)
  @MaxLength(COMMUNITY_ROTATION_TITLE_MAX)
  title?: string;

  @IsOptional()
  @Transform(({ value }) => trimOptional(value))
  @IsString()
  @MaxLength(COMMUNITY_ROTATION_TEXT_MAX)
  description?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimOptional(value))
  @IsString()
  @MaxLength(COMMUNITY_ROTATION_TEXT_MAX)
  accessRequirements?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimOptional(value))
  @IsString()
  @MaxLength(COMMUNITY_ROTATION_TEXT_MAX)
  additionalInfo?: string | null;

  @IsOptional()
  @IsIn(['L300', 'L500', 'L700', 'L1000_PLUS'])
  recommendedLevel?: 'L300' | 'L500' | 'L700' | 'L1000_PLUS';

  @IsOptional()
  @IsEnum(BosstiaryHuntMode)
  huntMode?: BosstiaryHuntMode;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn(COMMUNITY_PLANNED_DURATIONS)
  plannedDurationMinutes?: number;

  @IsOptional()
  @IsEnum(Vocation)
  vocation?: Vocation | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3000)
  characterLevel?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  partySize?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(600)
  observedTotalMinutes?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(600)
  combatMinutes?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(600)
  travelMinutes?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CommunityRotationBossInputDto)
  bosses?: CommunityRotationBossInputDto[];
}
