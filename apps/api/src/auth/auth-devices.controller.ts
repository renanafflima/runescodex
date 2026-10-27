import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { RATE_LIMITS } from '../common/rate-limit.config';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthUser } from './decorators/current-user.decorator';
import { DeviceService } from './device.service';
import { DeviceChallengeDto, RemoveDeviceDto } from './dto/device-proof.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth/devices')
export class AuthDevicesController {
  constructor(private readonly devices: DeviceService) {}

  @Post('challenge')
  @UseGuards(RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.deviceChallenge, scope: 'ip' })
  challenge(@Body() dto: DeviceChallengeDto) {
    return this.devices.createChallenge(dto.installationId, dto.publicKeySpki);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@CurrentUser() user: AuthUser) {
    return this.devices.list(user.userId, user.sessionId);
  }

  @Post(':id/remove')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.deviceRemove, scope: 'user' })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RemoveDeviceDto,
  ) {
    return this.devices.remove(
      user.userId,
      user.sessionId,
      id,
      dto,
      (password, hash) => bcrypt.compare(password, hash),
    );
  }
}
