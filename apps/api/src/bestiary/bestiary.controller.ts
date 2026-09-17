import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { BestiaryService } from './bestiary.service';
import { ListBestiaryQueryDto } from './dto/list-bestiary-query.dto';
import { UpdateBestiaryProgressDto } from './dto/update-bestiary-progress.dto';

@Controller('bestiary')
export class BestiaryController {
  constructor(private readonly bestiaryService: BestiaryService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  findAll(
    @Query() query: ListBestiaryQueryDto,
    @CurrentUser() user?: AuthUser | null,
  ) {
    return this.bestiaryService.findAll(query, user?.userId);
  }

  @Get(':slug')
  @UseGuards(OptionalJwtAuthGuard)
  findOne(@Param('slug') slug: string, @CurrentUser() user?: AuthUser | null) {
    return this.bestiaryService.findBySlug(slug, user?.userId);
  }

  @Patch(':slug/progress')
  @UseGuards(JwtAuthGuard)
  updateProgress(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
    @Body() dto: UpdateBestiaryProgressDto,
  ) {
    return this.bestiaryService.updateProgress(user.userId, slug, dto);
  }
}
