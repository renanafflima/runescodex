import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PremiumGuard } from '../billing/premium.guard';
import { RATE_LIMITS } from '../common/rate-limit.config';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { missingSchemaInterceptor } from '../common/missing-schema';
import { BosstiaryProgressService } from './bosstiary-progress.service';
import {
  AddSessionParticipantDto,
  CreateHuntSessionDto,
  CreatePartyDto,
  InvitePartyMemberDto,
  ListPartyQueryDto,
  ListSharedActivitiesQueryDto,
  TransferPartyLeaderDto,
  UpdatePartyDto,
} from './dto/party.dto';
import { HuntSessionService } from './hunt-session.service';
import { PartyNotificationsService } from './party-notifications.service';
import { PartyService } from './party.service';

@Controller('bosstiary/parties')
@UseGuards(JwtAuthGuard, PremiumGuard)
@UseInterceptors(
  missingSchemaInterceptor(
    'As tabelas de Party ainda não estão aplicadas neste banco. A migration de Party precisa ser publicada antes desta tela funcionar.',
  ),
)
export class PartyController {
  constructor(
    private readonly parties: PartyService,
    private readonly sessions: HuntSessionService,
    private readonly notifications: PartyNotificationsService,
    private readonly progress: BosstiaryProgressService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListPartyQueryDto) {
    return this.parties.listMine(user.userId, query);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.partyWrite, scope: 'user' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePartyDto) {
    return this.parties.create(user.userId, dto);
  }

  @Get('invitations/received')
  received(@CurrentUser() user: AuthUser, @Query() query: ListPartyQueryDto) {
    return this.parties.listReceived(user.userId, user.email, query);
  }

  @Get('invitations/sent')
  sent(@CurrentUser() user: AuthUser, @Query() query: ListPartyQueryDto) {
    return this.parties.listSent(user.userId, query);
  }

  @Post('invitations/:id/accept')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.partyWrite, scope: 'user' })
  accept(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.parties.accept(user.userId, user.email, id);
  }

  @Post('invitations/:id/decline')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.partyWrite, scope: 'user' })
  decline(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.parties.decline(user.userId, user.email, id);
  }

  @Get('notifications')
  notificationsList(
    @CurrentUser() user: AuthUser,
    @Query() query: ListPartyQueryDto,
  ) {
    return this.notifications.list(user.userId, query);
  }

  @Patch('notifications/:id/read')
  markRead(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.markRead(user.userId, id);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.parties.get(user.userId, id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.partyWrite, scope: 'user' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePartyDto,
  ) {
    return this.parties.update(user.userId, id, dto);
  }

  @Post(':id/archive')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.partyWrite, scope: 'user' })
  archive(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.parties.archive(user.userId, id);
  }

  @Post(':id/leave')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.partyWrite, scope: 'user' })
  leave(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.parties.leave(user.userId, id);
  }

  @Post(':id/leader')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.partyWrite, scope: 'user' })
  transfer(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransferPartyLeaderDto,
  ) {
    return this.parties.transferLeader(user.userId, id, dto.userId);
  }

  @Post(':id/invitations')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.partyWrite, scope: 'user' })
  invite(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InvitePartyMemberDto,
  ) {
    return this.parties.invite(user.userId, id, dto);
  }

  @Delete(':id/invitations/:invitationId')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.partyWrite, scope: 'user' })
  cancelInvite(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ) {
    return this.parties.cancelInvite(user.userId, id, invitationId);
  }

  @Delete(':id/members/:userId')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.partyWrite, scope: 'user' })
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
  ) {
    return this.parties.removeMember(user.userId, id, targetUserId);
  }

  @Get(':id/sessions')
  listSessions(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListPartyQueryDto,
  ) {
    return this.sessions.list(user.userId, id, query);
  }

  @Post(':id/sessions')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.partyWrite, scope: 'user' })
  createSession(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateHuntSessionDto,
  ) {
    return this.sessions.create(user.userId, id, dto);
  }

  @Get(':id/sessions/:sessionId')
  getSession(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.sessions.get(user.userId, id, sessionId);
  }

  @Post(':id/sessions/:sessionId/start')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.partyWrite, scope: 'user' })
  startSession(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.sessions.start(user.userId, id, sessionId);
  }

  @Post(':id/sessions/:sessionId/complete')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.partyWrite, scope: 'user' })
  completeSession(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.sessions.complete(user.userId, id, sessionId);
  }

  @Post(':id/sessions/:sessionId/cancel')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.partyWrite, scope: 'user' })
  cancelSession(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.sessions.cancel(user.userId, id, sessionId);
  }

  @Post(':id/sessions/:sessionId/participants')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.partyWrite, scope: 'user' })
  addParticipant(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: AddSessionParticipantDto,
  ) {
    return this.sessions.addParticipant(user.userId, id, sessionId, dto);
  }

  @Get(':id/activities')
  sharedActivities(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListSharedActivitiesQueryDto,
  ) {
    return this.progress.listShared(user.userId, id, query);
  }
}
