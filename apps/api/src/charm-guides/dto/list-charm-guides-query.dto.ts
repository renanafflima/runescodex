import { IsEnum, IsOptional } from 'class-validator';
import { CharmGuideCpCategory } from '../../../generated/prisma/client.js';
import { PageQueryDto } from '../../common/dto/page-query.dto';

export enum CharmGuideSort {
  RECENT = 'RECENT',
  LIKED = 'LIKED',
}

export class ListCharmGuidesQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(CharmGuideCpCategory)
  cpCategory?: CharmGuideCpCategory;

  @IsOptional()
  @IsEnum(CharmGuideSort)
  sort?: CharmGuideSort = CharmGuideSort.RECENT;
}
