import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  BosstiaryHuntMode,
  Difficulty,
} from '../../../generated/prisma/client.js';
import { PageQueryDto } from '../../common/dto/page-query.dto';
import { BOSSTIARY_LEVEL_BANDS } from '../bosstiary.constants';

export class ListBosstiaryQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  @IsOptional()
  @IsEnum(BosstiaryHuntMode)
  huntMode?: BosstiaryHuntMode;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([...BOSSTIARY_LEVEL_BANDS])
  recommendedLevel?: number;

  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  officialCategory?: string;
}
