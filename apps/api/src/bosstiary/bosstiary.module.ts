import { Module } from '@nestjs/common';
import { BosstiaryCommentsController } from './bosstiary-comments.controller';
import { BosstiaryCommentsService } from './bosstiary-comments.service';
import { BosstiaryController } from './bosstiary.controller';
import { BosstiaryService } from './bosstiary.service';

@Module({
  controllers: [BosstiaryController, BosstiaryCommentsController],
  providers: [BosstiaryService, BosstiaryCommentsService],
})
export class BosstiaryModule {}
