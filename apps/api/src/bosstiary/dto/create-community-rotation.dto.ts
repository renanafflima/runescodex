import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
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
  ValidateNested,
} from 'class-validator';
import {
  BosstiaryHuntMode,
  BosstiaryVisibility,
  Vocation,
} from '../../../generated/prisma/client.js';
import { CommunityRotationBossInputDto } from './community-rotation-boss-input.dto';

export const COMMUNITY_ROTATION_TITLE_MAX = 120;
export const COMMUNITY_ROTATION_TEXT_MAX = 4000;
export const COMMUNITY_PLANNED_DURATIONS = [15, 30, 60] as const;

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

function trimOptional(value: unknown) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

export class CreateCommunityRotationDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(3)
  @MaxLength(COMMUNITY_ROTATION_TITLE_MAX)
  title: string;

  @IsOptional()
  @Transform(({ value }) => trimOptional(value))
  @IsString()
  @MaxLength(COMMUNITY_ROTATION_TEXT_MAX)
  description?: string;

  @IsOptional()
  @Transform(({ value }) => trimOptional(value))
  @IsString()
  @MaxLength(COMMUNITY_ROTATION_TEXT_MAX)
  accessRequirements?: string;

  @IsOptional()
  @Transform(({ value }) => trimOptional(value))
  @IsString()
  @MaxLength(COMMUNITY_ROTATION_TEXT_MAX)
  additionalInfo?: string;

  @IsIn(['L300', 'L500', 'L700', 'L1000_PLUS'])
  recommendedLevel: 'L300' | 'L500' | 'L700' | 'L1000_PLUS';

  @IsEnum(BosstiaryHuntMode)
  huntMode: BosstiaryHuntMode;

  @Type(() => Number)
  @IsInt()
  @IsIn(COMMUNITY_PLANNED_DURATIONS)
  plannedDurationMinutes: number;

  @IsOptional()
  @IsEnum(Vocation)
  vocation?: Vocation;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3000)
  characterLevel?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  partySize?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(600)
  observedTotalMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(600)
  combatMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(600)
  travelMinutes?: number;

  @IsOptional()
  @IsEnum(BosstiaryVisibility)
  visibility?: BosstiaryVisibility;

  @IsOptional()
  @IsUUID()
  partyId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CommunityRotationBossInputDto)
  bosses: CommunityRotationBossInputDto[];
}
