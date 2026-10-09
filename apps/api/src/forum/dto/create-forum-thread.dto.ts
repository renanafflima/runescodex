import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { ForumCategory } from '../../../generated/prisma/client.js';

export class CreateForumThreadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body: string;

  @IsEnum(ForumCategory)
  category: ForumCategory;
}
