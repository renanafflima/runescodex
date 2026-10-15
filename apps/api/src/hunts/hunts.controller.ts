import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PremiumGuard } from '../billing/premium.guard';
import { CatalogSlugPipe } from '../common/catalog-slug.pipe';
import { ListHuntsQueryDto } from './dto/list-hunts-query.dto';
import { HuntsService } from './hunts.service';

@Controller('hunts')
@UseGuards(JwtAuthGuard, PremiumGuard)
export class HuntsController {
  constructor(private readonly huntsService: HuntsService) {}

  @Get()
  findAll(@Query() query: ListHuntsQueryDto) {
    return this.huntsService.findAll(query);
  }

  @Get(':slug')
  findOne(@Param('slug', CatalogSlugPipe) slug: string) {
    return this.huntsService.findBySlug(slug);
  }
}
