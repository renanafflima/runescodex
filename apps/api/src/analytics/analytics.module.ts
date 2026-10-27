import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ContentViewsController } from './content-views.controller';
import { ContentViewsService } from './content-views.service';

@Module({
  imports: [AuthModule],
  controllers: [ContentViewsController],
  providers: [ContentViewsService],
  exports: [ContentViewsService],
})
export class AnalyticsModule {}
