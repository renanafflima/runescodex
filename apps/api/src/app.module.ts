import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BestiaryModule } from './bestiary/bestiary.module';
import { CharactersModule } from './characters/characters.module';
import { ForumModule } from './forum/forum.module';
import { HuntsModule } from './hunts/hunts.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CharactersModule,
    HuntsModule,
    BestiaryModule,
    ForumModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
