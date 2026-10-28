import {
  ConflictException,
  Injectable,
  Logger,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { loggedErrorSummary } from '../common/redact-error';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { BillingService } from '../billing/billing.service';
import { PendingLicenseGrantService } from '../billing/pending-license-grant.service';
import { PrismaService } from '../prisma/prisma.service';
import { DeviceService } from './device.service';
import { ReferralService } from '../referrals/referral.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { DeviceProofDto } from './dto/device-proof.dto';
import { GoogleIdentityService } from './google-identity';

const BCRYPT_ROUNDS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

export type JwtPayload = {
  sub: string;
  email: string;
  sid: string;
};

function isUniqueConflict(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}

function accessTokenTtlMs() {
  const raw = (process.env.JWT_EXPIRES_IN || '7d').trim();
  const match = /^(\d+)([dhms])$/.exec(raw);
  if (!match) {
    return 7 * DAY_MS;
  }
  const amount = Number(match[1]);
  const unit = match[2];
  const scale =
    unit === 'd'
      ? DAY_MS
      : unit === 'h'
        ? 60 * 60 * 1000
        : unit === 'm'
          ? 60 * 1000
          : 1000;
  return amount * scale;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly billing: BillingService,
    private readonly google: GoogleIdentityService,
    private readonly devices: DeviceService,
    @Optional() private readonly referrals?: ReferralService,
    @Optional() private readonly pendingGrants?: PendingLicenseGrantService,
  ) {}

  async register(dto: RegisterDto) {
    const email = this.normalizeEmail(dto.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });

    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    let user: { id: string; email: string; role: string };
    try {
      user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
        },
        select: {
          id: true,
          email: true,
          role: true,
          googleSub: true,
        },
      });
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw new ConflictException('Email already in use');
      }
      throw error;
    }

    await this.attachReferral(user.id, dto.referralCode);
    await this.claimPendingGrants(user.id, user.email);
    const deviceId = await this.devices.claim(user.id, dto.device);
    return {
      user: await this.presentUser(user),
      accessToken: await this.openSession(user.id, user.email, deviceId),
      accountCreated: true,
    };
  }

  async login(dto: LoginDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const matches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.claimPendingGrants(user.id, user.email);
    const deviceId = await this.devices.claim(user.id, dto.device);
    return {
      user: await this.presentUser(user),
      accessToken: await this.openSession(user.id, user.email, deviceId),
    };
  }

  async loginWithGoogle(
    credential: string,
    device: DeviceProofDto,
    referralCode?: string,
  ) {
    const identity = await this.google.verify(credential);
    this.logger.log('auth.google.stage=verified');
    const linked = await this.prisma.user.findUnique({
      where: { googleSub: identity.sub },
    });
    if (linked) {
      if (this.normalizeEmail(linked.email) !== identity.email) {
        throw new ConflictException(
          'Google account cannot be used for this email',
        );
      }
      this.logger.log('auth.google.stage=linked_user');
      await this.claimPendingGrants(linked.id, linked.email);
      return this.sessionFor(linked, device);
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: identity.email },
    });
    if (existing) {
      throw new ConflictException(
        'Google sign-in is not linked to this account',
      );
    }

    try {
      const user = await this.prisma.user.create({
        data: {
          email: identity.email,
          googleSub: identity.sub,
        },
        select: {
          id: true,
          email: true,
          role: true,
          googleSub: true,
        },
      });
      this.logger.log('auth.google.stage=created_user');
      await this.attachReferral(user.id, referralCode);
      await this.claimPendingGrants(user.id, user.email);
      return {
        ...(await this.sessionFor(user, device)),
        accountCreated: true,
      };
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw new ConflictException(
          'Google sign-in is not linked to this account',
        );
      }
      throw error;
    }
  }

  async linkGoogle(userId: string, credential: string) {
    const identity = await this.google.verify(credential);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    if (this.normalizeEmail(user.email) !== identity.email) {
      throw new ConflictException(
        'Google account email does not match this account',
      );
    }
    if (user.googleSub && user.googleSub !== identity.sub) {
      throw new ConflictException(
        'Google sign-in is already linked to this account',
      );
    }
    const owner = await this.prisma.user.findUnique({
      where: { googleSub: identity.sub },
    });
    if (owner && owner.id !== user.id) {
      throw new ConflictException(
        'Google account is already linked to another user',
      );
    }
    if (user.googleSub === identity.sub) {
      return { user: await this.presentUser(user) };
    }
    try {
      const updated = await this.prisma.user.update({
        where: { id: user.id },
        data: { googleSub: identity.sub },
        select: {
          id: true,
          email: true,
          role: true,
          googleSub: true,
        },
      });
      return { user: await this.presentUser(updated) };
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw new ConflictException(
          'Google account is already linked to another user',
        );
      }
      throw error;
    }
  }

  async logout(sessionId: string) {
    await this.prisma.authSession.deleteMany({ where: { id: sessionId } });
  }

  async authenticate(token: string) {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException();
    }
    if (!payload?.sub || !payload.sid) {
      throw new UnauthorizedException();
    }
    await this.assertActiveSession(payload.sid, payload.sub);
    return {
      userId: payload.sub,
      email: payload.email,
      sessionId: payload.sid,
    };
  }

  async assertActiveSession(sessionId: string, userId: string) {
    const session = await this.prisma.authSession.findUnique({
      where: { id: sessionId },
    });
    if (
      !session ||
      session.userId !== userId ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException();
    }
    if (!session.deviceId) return;
    const device = await this.prisma.authDevice.findUnique({
      where: { id: session.deviceId },
    });
    if (!device || device.userId !== userId || device.status !== 'ACTIVE') {
      throw new UnauthorizedException();
    }
    const staleBefore = Date.now() - 10 * 60 * 1000;
    if (device.lastSeenAt.getTime() < staleBefore) {
      await this.prisma.authDevice.updateMany({
        where: { id: device.id, status: 'ACTIVE' },
        data: { lastSeenAt: new Date() },
      });
    }
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        googleSub: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return this.presentUser(user);
  }

  private async sessionFor(
    user: {
      id: string;
      email: string;
      role: string;
      googleSub?: string | null;
    },
    device: DeviceProofDto,
  ) {
    const deviceId = await this.devices.claim(user.id, device);
    return {
      user: await this.presentUser(user),
      accessToken: await this.openSession(user.id, user.email, deviceId),
    };
  }

  private async presentUser(user: {
    id: string;
    email: string;
    role: string;
    googleSub?: string | null;
  }) {
    const premium = await this.billing.getPremium(user.id);
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      googleLinked: Boolean(user.googleSub),
      premium,
    };
  }

  private async attachReferral(userId: string, referralCode?: string) {
    if (!this.referrals) return;
    await this.referrals.ensureCode(userId);
    await this.referrals.attribute(userId, referralCode);
  }

  private async claimPendingGrants(userId: string, email: string) {
    if (!this.pendingGrants) return;
    try {
      await this.pendingGrants.claimForAuthenticatedUser(userId, email);
    } catch (error) {
      this.logger.warn(
        `auth.pending_grant.skipped ${loggedErrorSummary(error)}`,
      );
    }
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private async openSession(userId: string, email: string, deviceId: string) {
    await this.prisma.authSession.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    const session = await this.prisma.authSession.create({
      data: {
        userId,
        deviceId,
        expiresAt: new Date(Date.now() + accessTokenTtlMs()),
      },
    });
    return this.jwtService.signAsync({
      sub: userId,
      email,
      sid: session.id,
    });
  }
}
