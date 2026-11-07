import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PageQueryDto } from '../../common/dto/page-query.dto';

const LEVELS = ['ALL', '300', '500', '700', '1000_PLUS'] as const;
const MODES = ['ALL', 'SOLO', 'PARTY'] as const;
const DURATIONS = ['ALL', '15', '30', '60'] as const;
const SORTS = ['LIKES', 'RECENT', 'COMMENTS'] as const;

export type CommunityLevelFilter = (typeof LEVELS)[number];
export type CommunityModeFilter = (typeof MODES)[number];
export type CommunityDurationFilter = (typeof DURATIONS)[number];
export type CommunityRotationSortOption = (typeof SORTS)[number];

function trimOptional(value: unknown) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

export class ListCommunityRotationsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(LEVELS)
  level?: CommunityLevelFilter;

  @IsOptional()
  @IsIn(MODES)
  mode?: CommunityModeFilter;

  @IsOptional()
  @IsIn(DURATIONS)
  duration?: CommunityDurationFilter;

  @IsOptional()
  @IsIn(SORTS)
  sort?: CommunityRotationSortOption;

  @IsOptional()
  @Transform(({ value }) => trimOptional(value))
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rankingPreview?: number;
}
