import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BestiaryModule } from './bestiary/bestiary.module';
import { CharactersModule } from './characters/characters.module';
import { ForumModule } from './forum/forum.module';
import { HuntsModule } from './hunts/hunts.module';
import { PrismaModule } from './prisma/prisma.module';
import { RewardsModule } from './rewards/rewards.module';
import { SecurityModule } from './common/security.module';
import { TicketsModule } from './tickets/tickets.module';

@Module({
  imports: [
    PrismaModule,
    SecurityModule,
    AuthModule,
    CharactersModule,
    HuntsModule,
    BestiaryModule,
    ForumModule,
    RewardsModule,
    TicketsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
