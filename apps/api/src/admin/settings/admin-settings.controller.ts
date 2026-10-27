import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { IsInt, Max, Min } from 'class-validator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../admin.guard';
import { AdminSettingsService } from './admin-settings.service';

class SaveAdminSettingDto {
  @IsInt()
  @Min(1)
  @Max(43_200)
  amount!: number;
}

@Controller('admin/settings')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminSettingsController {
  constructor(private readonly settings: AdminSettingsService) {}

  @Get()
  list() {
    return this.settings.list();
  }

  @Put(':key')
  save(
    @CurrentUser() user: AuthUser,
    @Param('key') key: string,
    @Body() dto: SaveAdminSettingDto,
  ) {
    return this.settings.save(user.userId, key, dto.amount);
  }

  @Delete(':key')
  remove(@CurrentUser() user: AuthUser, @Param('key') key: string) {
    return this.settings.remove(user.userId, key);
  }
}
