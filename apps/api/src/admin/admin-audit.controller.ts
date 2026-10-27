import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { resolvePeriod } from './insights/admin-period';
import { PageQueryDto } from '../common/dto/page-query.dto';
import { AdminAuditService } from '../audit/admin-audit.service';
import { AdminGuard } from './admin.guard';

class ListAdminAuditQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(['today', '24h', '7d', '30d', '90d', 'custom'])
  preset?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  entityType?: string;

  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}

@Controller('admin/audit')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminAuditController {
  constructor(private readonly audit: AdminAuditService) {}

  @Get()
  list(@Query() query: ListAdminAuditQueryDto) {
    if (!query.preset && !query.from && !query.to) {
      return this.audit.list(query);
    }
    const period = resolvePeriod(query);
    return this.audit.list({
      ...query,
      from: period.from.toISOString(),
      to: period.to.toISOString(),
    });
  }
}
