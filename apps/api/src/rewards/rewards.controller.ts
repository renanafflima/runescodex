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
import { ConvertRewardsDto } from './dto/convert-rewards.dto';
import { ListMissionsQueryDto } from './dto/list-missions-query.dto';
import { RedeemRewardDto } from './dto/redeem-reward.dto';
import { RewardsService } from './rewards.service';

@Controller('rewards')
@UseGuards(JwtAuthGuard)
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthUser) {
    return this.rewardsService.getMe(user.userId);
  }

  @Get('missions')
  listMissions(
    @CurrentUser() user: AuthUser,
    @Query() query: ListMissionsQueryDto,
  ) {
    return this.rewardsService.listMissions(user.userId, query);
  }

  @Get('catalog')
  listCatalog() {
    return this.rewardsService.listCatalog();
  }

  @Post('convert')
  convert(@CurrentUser() user: AuthUser, @Body() dto: ConvertRewardsDto) {
    return this.rewardsService.convert(user.userId, dto);
  }

  @Post('redeem')
  redeem(@CurrentUser() user: AuthUser, @Body() dto: RedeemRewardDto) {
    return this.rewardsService.redeem(user.userId, dto);
  }

  @Get('redemptions')
  listRedemptions(@CurrentUser() user: AuthUser) {
    return this.rewardsService.listRedemptions(user.userId);
  }

  @Get('redemptions/:id')
  getRedemption(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.rewardsService.getRedemption(user.userId, id);
  }
}
