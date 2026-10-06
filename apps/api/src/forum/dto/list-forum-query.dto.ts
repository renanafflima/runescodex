import { IsEnum, IsOptional } from 'class-validator';
import { ForumThreadStatus } from '../../../generated/prisma/client.js';
import { PageQueryDto } from '../../common/dto/page-query.dto';

export class ListForumQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(ForumThreadStatus)
  status?: ForumThreadStatus;
}
