import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
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
        },
      });
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw new ConflictException('Email already in use');
      }
      throw error;
    }

    return {
      user,
      accessToken: await this.openSession(user.id, user.email),
    };
  }

  async login(dto: LoginDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const matches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      accessToken: await this.openSession(user.id, user.email),
    };
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
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return user;
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private async openSession(userId: string, email: string) {
    await this.prisma.authSession.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    const session = await this.prisma.authSession.create({
      data: {
        userId,
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
