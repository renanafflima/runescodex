import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PageQueryDto } from '../../common/dto/page-query.dto';

const TERMS = ['LIFETIME', 'FIXED'] as const;
const GRANT_CATEGORIES = [
  'COLLABORATOR',
  'PARTNERSHIP',
  'CONTENT_CREATOR',
  'COMPENSATION',
  'OTHER',
] as const;
const VOUCHER_BENEFITS = ['FREE', 'PARTNERSHIP', 'PROMOTIONAL'] as const;
const LICENSE_STATUSES = ['ACTIVE', 'SUSPENDED', 'REVOKED', 'EXPIRED'] as const;
const LICENSE_SOURCES = [
  'PURCHASE',
  'VOUCHER',
  'ADMIN_GRANT',
  'PARTNERSHIP',
  'COMPENSATION',
] as const;
const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'] as const;

export class LicenseReasonDto {
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  reason!: string;
}

export class ExtendLicenseDto extends LicenseReasonDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  durationDays!: number;
}

export class GrantLicenseDto extends LicenseReasonDto {
  @IsUUID()
  userId!: string;

  @IsIn(TERMS)
  term!: (typeof TERMS)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  durationDays?: number;

  @IsIn(GRANT_CATEGORIES)
  category!: (typeof GRANT_CATEGORIES)[number];
}

export class CreateVoucherDto {
  @IsIn(VOUCHER_BENEFITS)
  benefit!: (typeof VOUCHER_BENEFITS)[number];

  @IsIn(TERMS)
  term!: (typeof TERMS)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  durationDays?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  maxRedemptions!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  perUserLimit!: number;

  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @IsOptional()
  @IsISO8601()
  endsAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  campaign?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ListLicensesQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsIn(LICENSE_STATUSES)
  status?: (typeof LICENSE_STATUSES)[number];

  @IsOptional()
  @IsIn(TERMS)
  term?: (typeof TERMS)[number];

  @IsOptional()
  @IsIn(LICENSE_SOURCES)
  source?: (typeof LICENSE_SOURCES)[number];

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}

export class ListPaymentsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  status?: (typeof PAYMENT_STATUSES)[number];

  @IsOptional()
  @IsIn(['BRL', 'USD'])
  currency?: 'BRL' | 'USD';

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}

export class ListVouchersQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'PAUSED', 'EXHAUSTED', 'CLOSED', 'EXPIRED', 'SCHEDULED'])
  status?: string;
}

export class ListGrantsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsUUID()
  userId?: string;
}

export class SearchLicenseUsersQueryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  search!: string;
}
