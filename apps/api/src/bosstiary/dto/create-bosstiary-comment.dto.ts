import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { BOSSTIARY_COMMENT_MAX_LENGTH } from '../bosstiary.constants';

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateBosstiaryCommentDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(BOSSTIARY_COMMENT_MAX_LENGTH)
  content: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}
