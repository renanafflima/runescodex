import { Module } from '@nestjs/common';
import { RewardsModule } from '../rewards/rewards.module';
import { ForumController } from './forum.controller';
import { ForumService } from './forum.service';

@Module({
  imports: [RewardsModule],
  controllers: [ForumController],
  providers: [ForumService],
})
export class ForumModule {}
