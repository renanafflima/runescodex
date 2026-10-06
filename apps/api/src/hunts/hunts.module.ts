import { Module } from '@nestjs/common';
import { HuntCommentsController } from './hunt-comments.controller';
import { HuntCommentsService } from './hunt-comments.service';
import { HuntsController } from './hunts.controller';
import { HuntsService } from './hunts.service';

@Module({
  controllers: [HuntsController, HuntCommentsController],
  providers: [HuntsService, HuntCommentsService],
})
export class HuntsModule {}
