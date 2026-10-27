import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { BillingService, inactivePremium } from '../billing/billing.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { DeviceService } from './device.service';
import { GoogleIdentityService } from './google-identity';

const device = {
  installationId: '11111111-1111-4111-8111-111111111111',
  challengeId: '22222222-2222-4222-8222-222222222222',
  signature: 'c2lnbmF0dXJl',
};

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('@nestjs/jwt', () => ({
  JwtService: class JwtService {},
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    authSession: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        expiresAt: new Date('2026-10-01T00:00:00.000Z'),
      }),
    },
  };
  const jwtService = {
    signAsync: jest.fn().mockResolvedValue('signed-token'),
  };
  const billing = {
    getPremium: jest.fn().mockResolvedValue(inactivePremium()),
  };
  const google = {
    verify: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    billing.getPremium.mockResolvedValue(inactivePremium());
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: BillingService, useValue: billing },
        { provide: GoogleIdentityService, useValue: google },
        {
          provide: DeviceService,
          useValue: { claim: jest.fn().mockResolvedValue('device-1') },
        },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  it('registers a user and never returns the hash', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'user@email.com',
      role: 'USER',
    });

    const result = await service.register({
      email: '  User@Email.com ',
      password: 'password1',
      device,
    });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: 'user@email.com',
        passwordHash: 'hashed-password',
      },
      select: { id: true, email: true, role: true, googleSub: true },
    });
    expect(result.user).toEqual({
      id: 'user-1',
      email: 'user@email.com',
      role: 'USER',
      googleLinked: false,
      premium: inactivePremium(),
    });
    expect(result.accessToken).toBe('signed-token');
    expect(JSON.stringify(result)).not.toContain('hashed-password');
    expect(JSON.stringify(result)).not.toContain('password1');
  });

  it('rejects duplicate emails', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });

    await expect(
      service.register({
        email: 'user@email.com',
        password: 'password1',
        device,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('turns a concurrent unique-email insert into a conflict', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    prisma.user.create.mockRejectedValue({ code: 'P2002' });

    await expect(
      service.register({
        email: 'user@email.com',
        password: 'password1',
        device,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in with a valid password', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@email.com',
      passwordHash: 'hashed-password',
      role: 'USER',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await service.login({
      email: 'user@email.com',
      password: 'password1',
      device,
    });

    expect(result.user).toEqual({
      id: 'user-1',
      email: 'user@email.com',
      role: 'USER',
      googleLinked: false,
      premium: inactivePremium(),
    });
    expect(result.accessToken).toBe('signed-token');
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'user-1', sid: 'session-1' }),
    );
    expect(JSON.stringify(result)).not.toContain('hashed-password');
  });

  it('uses the same error for invalid email or password', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login({
        email: 'missing@email.com',
        password: 'password1',
        device,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@email.com',
      passwordHash: 'hashed-password',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.login({ email: 'user@email.com', password: 'wrong', device }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns the authenticated user without hash', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@email.com',
      role: 'USER',
    });

    await expect(service.me('user-1')).resolves.toEqual({
      id: 'user-1',
      email: 'user@email.com',
      role: 'USER',
      googleLinked: false,
      premium: inactivePremium(),
    });
  });

  it('rejects a Google-only account on the password login', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@email.com',
      passwordHash: null,
      role: 'USER',
      googleSub: 'google-subject',
    });

    await expect(
      service.login({ email: 'user@email.com', password: 'password1', device }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it('rejects an invalid Google credential before touching accounts', async () => {
    google.verify.mockRejectedValue(
      new UnauthorizedException('Invalid Google credential'),
    );

    await expect(
      service.loginWithGoogle('invalid-token', device),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('rejects an unverified Google email', async () => {
    google.verify.mockRejectedValue(
      new UnauthorizedException('Google email is not verified'),
    );

    await expect(
      service.loginWithGoogle('unverified-token', device),
    ).rejects.toMatchObject({ message: 'Google email is not verified' });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('does not link a password account that shares the Google email', async () => {
    google.verify.mockResolvedValue({
      sub: 'google-subject',
      email: 'user@email.com',
    });
    prisma.user.findUnique.mockImplementation(
      async ({ where }: { where: { googleSub?: string; email?: string } }) => {
        if (where.googleSub) return null;
        if (where.email) {
          return {
            id: 'user-1',
            email: 'user@email.com',
            passwordHash: 'hashed-password',
            role: 'USER',
            googleSub: null,
          };
        }
        return null;
      },
    );

    await expect(
      service.loginWithGoogle('valid-token', device),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('creates a normal user from a new verified Google identity and issues the session JWT', async () => {
    google.verify.mockResolvedValue({
      sub: 'google-subject',
      email: 'new@email.com',
    });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'user-2',
      email: 'new@email.com',
      role: 'USER',
      googleSub: 'google-subject',
    });

    const result = await service.loginWithGoogle('valid-token', device);

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { email: 'new@email.com', googleSub: 'google-subject' },
      select: { id: true, email: true, role: true, googleSub: true },
    });
    expect(result.user).toEqual({
      id: 'user-2',
      email: 'new@email.com',
      role: 'USER',
      googleLinked: true,
      premium: inactivePremium(),
    });
    expect(result.user.role).toBe('USER');
    expect(result.accessToken).toBe('signed-token');
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'user-2',
        email: 'new@email.com',
        sid: 'session-1',
      }),
    );
    expect(JSON.stringify(result)).not.toContain('google-subject');
  });

  it('signs in an already linked Google account with the session JWT', async () => {
    google.verify.mockResolvedValue({
      sub: 'google-subject',
      email: 'user@email.com',
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@email.com',
      role: 'USER',
      googleSub: 'google-subject',
    });

    const result = await service.loginWithGoogle('valid-token', device);

    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(result.user.googleLinked).toBe(true);
    expect(result.accessToken).toBe('signed-token');
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'user-1', sid: 'session-1' }),
    );
  });
});
