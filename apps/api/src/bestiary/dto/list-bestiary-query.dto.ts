import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { Difficulty } from '../../../generated/prisma/client.js';
import { PageQueryDto } from '../../common/dto/page-query.dto';

export class ListBestiaryQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;
}
