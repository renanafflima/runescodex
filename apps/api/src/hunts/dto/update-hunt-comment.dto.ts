import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { HUNT_COMMENT_MAX_LENGTH } from './create-hunt-comment.dto';

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class UpdateHuntCommentDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(HUNT_COMMENT_MAX_LENGTH)
  content: string;
}
