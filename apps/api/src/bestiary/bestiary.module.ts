import { Module } from '@nestjs/common';
import { BestiaryController } from './bestiary.controller';
import { BestiaryService } from './bestiary.service';

@Module({
  controllers: [BestiaryController],
  providers: [BestiaryService],
})
export class BestiaryModule {}
