import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  ForumCategory,
  ForumThreadStatus,
} from '../../../generated/prisma/client.js';
import { PageQueryDto } from '../../common/dto/page-query.dto';

export class ListForumQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(ForumThreadStatus)
  status?: ForumThreadStatus;

  @IsOptional()
  @IsEnum(ForumCategory)
  category?: ForumCategory;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  authorId?: string;
}
