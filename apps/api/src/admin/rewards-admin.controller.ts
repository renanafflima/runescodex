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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from './admin.guard';
import { ApproveRedemptionDto } from './dto/approve-redemption.dto';
import { CancelRedemptionDto } from './dto/cancel-redemption.dto';
import { DeliverRedemptionDto } from './dto/deliver-redemption.dto';
import { ListAdminRedemptionsQueryDto } from './dto/list-admin-redemptions-query.dto';
import { RewardsAdminService } from './rewards-admin.service';

@Controller('admin/rewards')
@UseGuards(JwtAuthGuard, AdminGuard)
export class RewardsAdminController {
  constructor(private readonly rewardsAdminService: RewardsAdminService) {}

  @Get('redemptions')
  list(@Query() query: ListAdminRedemptionsQueryDto) {
    return this.rewardsAdminService.list(query);
  }

  @Get('redemptions/:id')
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.rewardsAdminService.getById(id);
  }

  @Post('redemptions/:id/approve')
  approve(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveRedemptionDto,
  ) {
    return this.rewardsAdminService.approve(user.userId, id, dto);
  }

  @Post('redemptions/:id/deliver')
  deliver(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeliverRedemptionDto,
  ) {
    return this.rewardsAdminService.deliver(user.userId, id, dto);
  }

  @Post('redemptions/:id/cancel')
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelRedemptionDto,
  ) {
    return this.rewardsAdminService.cancel(user.userId, id, dto);
  }
}
