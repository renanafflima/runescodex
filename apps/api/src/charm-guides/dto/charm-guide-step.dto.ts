import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  IsCatalogCreatureId,
  IsCatalogHuntId,
} from '../../common/catalog-id.validators';

export class CharmGuideStepDto {
  @IsOptional()
  @IsCatalogHuntId()
  huntId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsCatalogCreatureId()
  creatureIds: string[];
}

export class CharmGuideStepsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CharmGuideStepDto)
  steps: CharmGuideStepDto[];
}
