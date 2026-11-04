import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsString, Max, Min } from 'class-validator';
import {
  BosstiaryHuntMode,
  Vocation,
} from '../../../generated/prisma/client.js';
import {
  BOSSTIARY_ORIGIN_CITIES,
  BOSSTIARY_TIME_OPTIONS,
} from '../bosstiary.constants';

export class FindRotationsQueryDto {
  @Type(() => Number)
  @IsInt()
  @IsIn([...BOSSTIARY_TIME_OPTIONS])
  availableMinutes: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3000)
  level: number;

  @IsEnum(BosstiaryHuntMode)
  huntMode: BosstiaryHuntMode;

  @IsEnum(Vocation)
  vocation: Vocation;

  @IsString()
  @IsIn([...BOSSTIARY_ORIGIN_CITIES])
  originCity: string;
}
