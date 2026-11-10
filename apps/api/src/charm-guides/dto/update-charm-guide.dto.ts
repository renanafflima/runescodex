import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  CharmGuideCpCategory,
  CharmGuideDifficulty,
} from '../../../generated/prisma/client.js';
import { CharmGuideStepDto } from './charm-guide-step.dto';

export class UpdateCharmGuideDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsEnum(CharmGuideCpCategory)
  cpCategory?: CharmGuideCpCategory;

  @IsOptional()
  @IsEnum(CharmGuideDifficulty)
  difficulty?: CharmGuideDifficulty;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverImage?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CharmGuideStepDto)
  steps?: CharmGuideStepDto[];
}
