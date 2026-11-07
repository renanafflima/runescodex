import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { COMMUNITY_ROTATION_COMMENT_MAX_LENGTH } from './create-community-rotation-comment.dto';

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class UpdateCommunityRotationCommentDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(COMMUNITY_ROTATION_COMMENT_MAX_LENGTH)
  content: string;
}
