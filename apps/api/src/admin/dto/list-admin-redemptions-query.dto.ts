import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export enum AdminRedemptionStatusFilter {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export class ListAdminRedemptionsQueryDto {
  @IsOptional()
  @IsEnum(AdminRedemptionStatusFilter)
  status?: AdminRedemptionStatusFilter;

  @IsOptional()
  @IsString()
  user?: string;

  @IsOptional()
  @IsString()
  reward?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
