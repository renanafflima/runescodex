import { Controller, Get, Param, Query } from '@nestjs/common';
import { ListHuntsQueryDto } from './dto/list-hunts-query.dto';
import { HuntsService } from './hunts.service';

@Controller('hunts')
export class HuntsController {
  constructor(private readonly huntsService: HuntsService) {}

  @Get()
  findAll(@Query() query: ListHuntsQueryDto) {
    return this.huntsService.findAll(query);
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.huntsService.findBySlug(slug);
  }
}
