import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { PageQueryDto } from '../common/dto/page-query.dto';
import { AdminGuard } from '../admin/admin.guard';
import { ReferralService } from './referral.service';

class ListReferralsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsIn(['WAITING_PURCHASE', 'REWARDED'])
  stage?: 'WAITING_PURCHASE' | 'REWARDED';
}

class ReasonDto {
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  reason!: string;
}

@Controller('admin/referrals')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminReferralsController {
  constructor(private readonly referrals: ReferralService) {}

  @Get('overview')
  overview() {
    return this.referrals.overview();
  }

  @Get()
  list(@Query() query: ListReferralsQueryDto) {
    return this.referrals.adminList(query);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.referrals.adminDetail(id);
  }

  @Post('rewards/:id/deliver')
  deliver(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.referrals.deliver(user.userId, id);
  }

  @Post('rewards/:id/hold')
  hold(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    return this.referrals.hold(user.userId, id, dto.reason);
  }

  @Post('rewards/:id/release')
  release(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    return this.referrals.release(user.userId, id, dto.reason);
  }

  @Post('orders/:orderId/reprocess')
  reprocess(
    @CurrentUser() user: AuthUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.referrals.reprocess(user.userId, orderId);
  }
}
