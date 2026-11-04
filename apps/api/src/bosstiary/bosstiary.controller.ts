import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PremiumGuard } from '../billing/premium.guard';
import { CatalogSlugPipe } from '../common/catalog-slug.pipe';
import { BosstiaryService } from './bosstiary.service';
import { FindRotationsQueryDto } from './dto/find-rotations.dto';
import { ListBosstiaryQueryDto } from './dto/list-bosstiary-query.dto';

@Controller('bosstiary')
@UseGuards(JwtAuthGuard, PremiumGuard)
export class BosstiaryController {
  constructor(private readonly bosstiaryService: BosstiaryService) {}

  @Get('meta')
  meta() {
    return this.bosstiaryService.meta();
  }

  @Get('rotations')
  rotations(@Query() query: FindRotationsQueryDto) {
    return this.bosstiaryService.findRotations(query);
  }

  @Get('bosses')
  findAll(@Query() query: ListBosstiaryQueryDto) {
    return this.bosstiaryService.findAll(query);
  }

  @Get('bosses/:slug')
  findOne(@Param('slug', CatalogSlugPipe) slug: string) {
    return this.bosstiaryService.findBySlug(slug);
  }
}
