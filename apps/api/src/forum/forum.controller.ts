import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateForumReplyDto } from './dto/create-forum-reply.dto';
import { CreateForumThreadDto } from './dto/create-forum-thread.dto';
import { ListForumQueryDto } from './dto/list-forum-query.dto';
import { ForumService } from './forum.service';

@Controller('forum')
export class ForumController {
  constructor(private readonly forumService: ForumService) {}

  @Get()
  findAll(@Query() query: ListForumQueryDto) {
    return this.forumService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.forumService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateForumThreadDto) {
    return this.forumService.create(user.userId, dto);
  }

  @Post(':id/replies')
  @UseGuards(JwtAuthGuard)
  createReply(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateForumReplyDto,
  ) {
    return this.forumService.createReply(user.userId, id, dto);
  }

  @Patch(':id/close')
  @UseGuards(JwtAuthGuard)
  close(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.forumService.close(user.userId, id);
  }
}
