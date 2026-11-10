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

export class CreateCharmGuideDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title: string;

  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  description: string;

  @IsEnum(CharmGuideCpCategory)
  cpCategory: CharmGuideCpCategory;

  @IsEnum(CharmGuideDifficulty)
  difficulty: CharmGuideDifficulty;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverImage?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CharmGuideStepDto)
  steps: CharmGuideStepDto[];
}
