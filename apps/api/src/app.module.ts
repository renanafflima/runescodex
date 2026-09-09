import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CharactersModule } from './characters/characters.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, AuthModule, CharactersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
