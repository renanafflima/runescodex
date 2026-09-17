import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Difficulty, Vocation } from '../../../generated/prisma/client.js';

export class ListHuntsQueryDto {
  @IsOptional()
  @IsEnum(Vocation)
  vocation?: Vocation;

  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  level?: number;
}
