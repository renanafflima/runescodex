import { IsEnum, IsOptional } from 'class-validator';
import { ForumThreadStatus } from '../../../generated/prisma/client.js';

export class ListForumQueryDto {
  @IsOptional()
  @IsEnum(ForumThreadStatus)
  status?: ForumThreadStatus;
}
