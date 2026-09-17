import { IsEnum, IsOptional } from 'class-validator';
import { Difficulty } from '../../../generated/prisma/client.js';

export class ListBestiaryQueryDto {
  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;
}
