import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

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
  };
  const jwtService = {
    signAsync: jest.fn().mockResolvedValue('signed-token'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
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
    });

    const result = await service.register({
      email: '  User@Email.com ',
      password: 'password1',
    });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: 'user@email.com',
        passwordHash: 'hashed-password',
      },
      select: { id: true, email: true },
    });
    expect(result.user).toEqual({ id: 'user-1', email: 'user@email.com' });
    expect(result.accessToken).toBe('signed-token');
    expect(JSON.stringify(result)).not.toContain('hashed-password');
    expect(JSON.stringify(result)).not.toContain('password1');
  });

  it('rejects duplicate emails', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });

    await expect(
      service.register({ email: 'user@email.com', password: 'password1' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('logs in with a valid password', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@email.com',
      passwordHash: 'hashed-password',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await service.login({
      email: 'user@email.com',
      password: 'password1',
    });

    expect(result.user).toEqual({ id: 'user-1', email: 'user@email.com' });
    expect(result.accessToken).toBe('signed-token');
    expect(JSON.stringify(result)).not.toContain('hashed-password');
  });

  it('uses the same error for invalid email or password', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login({ email: 'missing@email.com', password: 'password1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@email.com',
      passwordHash: 'hashed-password',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.login({ email: 'user@email.com', password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns the authenticated user without hash', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@email.com',
    });

    await expect(service.me('user-1')).resolves.toEqual({
      id: 'user-1',
      email: 'user@email.com',
    });
  });
});
