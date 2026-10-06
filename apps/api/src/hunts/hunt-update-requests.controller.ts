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
import { CatalogSlugPipe } from '../common/catalog-slug.pipe';
import { PageQueryDto } from '../common/dto/page-query.dto';
import { RATE_LIMITS } from '../common/rate-limit.config';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { CreateHuntUpdateRequestDto } from './dto/create-hunt-update-request.dto';
import { HuntUpdateRequestsService } from './hunt-update-requests.service';

@Controller('hunts')
export class HuntUpdateRequestsController {
  constructor(private readonly requests: HuntUpdateRequestsService) {}

  @Get(':slug/update-requests')
  @UseGuards(JwtAuthGuard)
  list(
    @CurrentUser() user: AuthUser,
    @Param('slug', CatalogSlugPipe) slug: string,
    @Query() query: PageQueryDto,
  ) {
    return this.requests.list(slug, user.userId, query);
  }

  @Get(':slug/update-requests/:requestId')
  @UseGuards(JwtAuthGuard)
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('slug', CatalogSlugPipe) slug: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ) {
    return this.requests.findOne(slug, requestId, user.userId);
  }

  @Post(':slug/update-requests')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.huntUpdateRequestWrite, scope: 'user' })
  create(
    @CurrentUser() user: AuthUser,
    @Param('slug', CatalogSlugPipe) slug: string,
    @Body() dto: CreateHuntUpdateRequestDto,
  ) {
    return this.requests.create(slug, user.userId, dto);
  }
}
