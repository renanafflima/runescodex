import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateCharacterDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  vocation?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  level?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  world?: string;
}
