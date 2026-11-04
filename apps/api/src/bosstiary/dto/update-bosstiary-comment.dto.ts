import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { BOSSTIARY_COMMENT_MAX_LENGTH } from '../bosstiary.constants';

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class UpdateBosstiaryCommentDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(BOSSTIARY_COMMENT_MAX_LENGTH)
  content: string;
}
