import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export const COMMUNITY_ROTATION_COMMENT_MAX_LENGTH = 1000;

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateCommunityRotationCommentDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(COMMUNITY_ROTATION_COMMENT_MAX_LENGTH)
  content: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}
