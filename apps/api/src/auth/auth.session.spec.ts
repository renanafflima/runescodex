import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AdminGuard } from '../admin/admin.guard';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('@nestjs/jwt', () => ({
  JwtService: class JwtService {},
}));

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

const SECRET = 'unit-test-jwt-secret';

type SessionRow = {
  id: string;
  userId: string;
  expiresAt: Date;
};

describe('auth sessions', () => {
  let service: AuthService;
  const sessions = new Map<string, SessionRow>();
  let sequence = 0;
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    authSession: {
      deleteMany: jest.fn(
        async ({
          where,
        }: {
          where: { id?: string; expiresAt?: { lt: Date } };
        }) => {
          if (where.id) {
            const removed = sessions.delete(where.id);
            return { count: removed ? 1 : 0 };
          }
          const cutoff = where.expiresAt?.lt?.getTime() ?? 0;
          let count = 0;
          for (const [id, row] of sessions) {
            if (row.expiresAt.getTime() < cutoff) {
              sessions.delete(id);
              count += 1;
            }
          }
          return { count };
        },
      ),
      create: jest.fn(
        async ({ data }: { data: { userId: string; expiresAt: Date } }) => {
          sequence += 1;
          const row = {
            id: `session-${sequence}`,
            userId: data.userId,
            expiresAt: data.expiresAt,
          };
          sessions.set(row.id, row);
          return row;
        },
      ),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        return sessions.get(where.id) ?? null;
      }),
    },
  };
  const jwtService = {
    signAsync: (payload: object) =>
      Promise.resolve(jwt.sign(payload, SECRET, { expiresIn: '7d' })),
    verifyAsync: (token: string) => Promise.resolve(jwt.verify(token, SECRET)),
  };

  beforeEach(async () => {
    sessions.clear();
    sequence = 0;
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@email.com',
      passwordHash: 'hashed-password',
      role: 'USER',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  async function login() {
    const result = await service.login({
      email: 'user@email.com',
      password: 'password1',
    });
    return result.accessToken;
  }

  it('accepts a token from login', async () => {
    const token = await login();

    await expect(service.authenticate(token)).resolves.toMatchObject({
      userId: 'user-1',
      sessionId: 'session-1',
    });
  });

  it('rejects the same token after logout', async () => {
    const token = await login();
    const current = await service.authenticate(token);

    await service.logout(current.sessionId);

    await expect(service.authenticate(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('keeps the other device signed in after one logout', async () => {
    const phone = await login();
    const tablet = await login();

    const phoneSession = await service.authenticate(phone);
    await service.logout(phoneSession.sessionId);

    await expect(service.authenticate(phone)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(service.authenticate(tablet)).resolves.toMatchObject({
      userId: 'user-1',
      sessionId: 'session-2',
    });
  });

  it('rejects an expired token', async () => {
    const token = jwt.sign(
      { sub: 'user-1', email: 'user@email.com', sid: 'session-old' },
      SECRET,
      { expiresIn: '-1s' },
    );

    await expect(service.authenticate(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a tampered token', async () => {
    const token = await login();
    const [header, body] = token.split('.');
    const tampered = `${header}.${body}.not-a-valid-signature`;

    await expect(service.authenticate(tampered)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe('admin access for a normal user', () => {
  it('rejects a user who is not an admin', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ role: 'USER' }),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [AdminGuard, { provide: PrismaService, useValue: prisma }],
    }).compile();
    const guard = moduleRef.get(AdminGuard);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { userId: 'user-1' } }),
      }),
    };

    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
