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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from './admin.guard';
import { ListAdminHuntUpdateRequestsQueryDto } from './dto/list-admin-hunt-update-requests-query.dto';
import { UpdateAdminHuntUpdateRequestDto } from './dto/update-admin-hunt-update-request.dto';
import { HuntUpdateRequestsAdminService } from './hunt-update-requests-admin.service';

@Controller('admin/hunt-update-requests')
@UseGuards(JwtAuthGuard, AdminGuard)
export class HuntUpdateRequestsAdminController {
  constructor(private readonly requests: HuntUpdateRequestsAdminService) {}

  @Get()
  list(@Query() query: ListAdminHuntUpdateRequestsQueryDto) {
    return this.requests.list(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.requests.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminHuntUpdateRequestDto,
  ) {
    return this.requests.update(id, dto);
  }
}
