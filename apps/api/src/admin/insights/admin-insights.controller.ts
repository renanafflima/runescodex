import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PageQueryDto } from '../../common/dto/page-query.dto';
import { AdminGuard } from '../admin.guard';
import { AdminInsightsService } from './admin-insights.service';

class PeriodQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(['today', '24h', '7d', '30d', '90d', 'custom'])
  preset?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  dimension?: string;

  @IsOptional()
  @IsIn(['EK', 'RP', 'ED', 'MS', 'EM'])
  vocation?: string;
}

@Controller('admin/insights')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminInsightsController {
  constructor(private readonly insights: AdminInsightsService) {}

  @Get('overview')
  overview(@Query() query: PeriodQueryDto) {
    return this.insights.overview(query);
  }

  @Get('series/:metric')
  series(@Param('metric') metric: string, @Query() query: PeriodQueryDto) {
    return this.insights.series(metric, query);
  }

  @Get('activity')
  activity() {
    return this.insights.activity();
  }

  @Get('alerts')
  alerts() {
    return this.insights.alerts();
  }

  @Get('badges')
  badges() {
    return this.insights.badges();
  }

  @Get('hunts')
  hunts(@Query() query: PeriodQueryDto) {
    return this.insights.huntRankings(query);
  }

  @Get('hunt-quality')
  huntQuality(@Query() query: PeriodQueryDto) {
    return this.insights.huntQuality(query);
  }

  @Get('creatures')
  creatures(@Query() query: PeriodQueryDto) {
    return this.insights.creatures(query);
  }

  @Get('forum')
  forum(@Query() query: PeriodQueryDto) {
    return this.insights.forum(query);
  }

  @Get('forum-threads')
  forumThreads(@Query() query: PeriodQueryDto) {
    return this.insights.forumThreads(query);
  }

  @Get('hunt-catalog')
  huntCatalog(@Query() query: PeriodQueryDto) {
    return this.insights.huntCatalog(query);
  }

  @Get('boss-views')
  bossViews(@Query() query: PeriodQueryDto) {
    return this.insights.bossViews(query);
  }

  @Get('search')
  search(@Query('q') q = '') {
    return this.insights.search(q);
  }

  @Get('users')
  users(@Query() query: PeriodQueryDto) {
    return this.insights.users(query);
  }

  @Get('users/:id')
  user(@Param('id', ParseUUIDPipe) id: string) {
    return this.insights.userDetail(id);
  }

  @Get('rankings/:dimension')
  rankings(
    @Param('dimension') dimension: string,
    @Query() query: PeriodQueryDto,
  ) {
    return this.insights.rankings(dimension, query);
  }

  @Get('search-misses')
  searchMisses(@Query() query: PeriodQueryDto) {
    return this.insights.searchMisses(query);
  }

  @Get('catalog')
  catalog() {
    return this.insights.catalog();
  }
}
