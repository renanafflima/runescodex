import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

function trimOptional(value: unknown) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

export class CommunityRotationBossInputDto {
  @IsOptional()
  @IsUUID()
  bossId?: string;

  @ValidateIf((item) => !item.bossId)
  @Transform(({ value }) => trimOptional(value))
  @IsString()
  @MinLength(2)
  @MaxLength(96)
  bossName?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(64)
  position: number;

  @IsOptional()
  @Transform(({ value }) => trimOptional(value))
  @IsString()
  @MaxLength(500)
  notes?: string;
}
