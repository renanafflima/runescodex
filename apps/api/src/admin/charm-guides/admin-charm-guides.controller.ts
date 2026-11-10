import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CharmGuideStatus } from '../../../generated/prisma/client.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../admin.guard';
import { CharmGuidesService } from '../../charm-guides/charm-guides.service';
import { UpdateAdminCharmGuideDto } from './dto/update-admin-charm-guide.dto';
import { IsEnum, IsOptional } from 'class-validator';

class ListAdminCharmGuidesQueryDto {
  @IsOptional()
  @IsEnum(CharmGuideStatus)
  status?: CharmGuideStatus;
}

@Controller('admin/charm-guides')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminCharmGuidesController {
  constructor(private readonly guides: CharmGuidesService) {}

  @Get()
  list(@Query() query: ListAdminCharmGuidesQueryDto) {
    return this.guides.adminList(query.status);
  }

  @Get(':id')
  detail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.guides.findOne(id, user.userId, undefined, {
      allowStaff: true,
    });
  }

  @Patch(':id')
  moderate(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminCharmGuideDto,
  ) {
    return this.guides.adminModerate(
      user.userId,
      id,
      dto.status,
      dto.adminResponse,
    );
  }
}
