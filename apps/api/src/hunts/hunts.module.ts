import { Module } from '@nestjs/common';
import { HuntCommentsController } from './hunt-comments.controller';
import { HuntCommentsService } from './hunt-comments.service';
import { HuntUpdateRequestsController } from './hunt-update-requests.controller';
import { HuntUpdateRequestsService } from './hunt-update-requests.service';
import { HuntsController } from './hunts.controller';
import { HuntsService } from './hunts.service';

@Module({
  controllers: [
    HuntsController,
    HuntCommentsController,
    HuntUpdateRequestsController,
  ],
  providers: [HuntsService, HuntCommentsService, HuntUpdateRequestsService],
})
export class HuntsModule {}
