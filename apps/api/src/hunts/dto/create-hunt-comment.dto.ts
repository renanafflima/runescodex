import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export const HUNT_COMMENT_MAX_LENGTH = 1000;

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateHuntCommentDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(HUNT_COMMENT_MAX_LENGTH)
  content: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}
