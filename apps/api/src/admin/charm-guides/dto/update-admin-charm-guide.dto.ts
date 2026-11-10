import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CharmGuideStatus } from '../../../../generated/prisma/client.js';

const ADMIN_STATUSES = [
  CharmGuideStatus.PUBLISHED,
  CharmGuideStatus.REJECTED,
  CharmGuideStatus.CHANGES_REQUESTED,
] as const;

export class UpdateAdminCharmGuideDto {
  @IsEnum(ADMIN_STATUSES)
  status: (typeof ADMIN_STATUSES)[number];

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  adminResponse?: string;
}
