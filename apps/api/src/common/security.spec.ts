import { BadRequestException, HttpException, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { AuthService } from '../auth/auth.service';
import { AdminPageAccess } from '../admin/admin-page.access';
import { validate } from 'class-validator';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AdminDashboardController } from '../admin/admin-dashboard.controller';
import { LoginDto } from '../auth/dto/login.dto';
import { CreateCharacterDto } from '../characters/dto/create-character.dto';
import { UpdateBestiaryProgressDto } from '../bestiary/dto/update-bestiary-progress.dto';
import { CatalogSlugPipe } from './catalog-slug.pipe';
import { publicHttpsUrl } from './https-url';
import { RATE_LIMIT_KEY } from './rate-limit.guard';
import { RateLimitService } from './rate-limit.service';
import {
  loggedErrorStack,
  loggedErrorSummary,
  publicErrorText,
} from './redact-error';
import { SafeExceptionFilter } from './safe-exception.filter';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('@nestjs/jwt', () => ({
  JwtService: class JwtService {},
}));

jest.mock('../auth/guards/jwt-auth.guard', () => ({
  JwtAuthGuard: class JwtAuthGuard {},
}));

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('public forum and input guards', () => {
  it('keeps only https urls', () => {
    const valid = 'https://www.youtube.com/watch?v=abc';
    expect(publicHttpsUrl(valid)).toBe(valid);
    expect(publicHttpsUrl('javascript:alert(1)')).toBeNull();
    expect(publicHttpsUrl('intent://scan/#Intent;end')).toBeNull();
    expect(publicHttpsUrl('file:///etc/passwd')).toBeNull();
    expect(publicHttpsUrl('data:text/html,hi')).toBeNull();
    expect(publicHttpsUrl('http://example.com')).toBeNull();
  });

  it('redacts connection strings from operator logs', () => {
    const text = publicErrorText(
      new Error('connect failed postgres://user:secret@host/db'),
    );
    expect(text).not.toContain('secret');
    expect(text).not.toContain('postgres://');
    expect(text).toContain('[redacted]');
  });

  it('rejects oversized or invalid catalog inputs', async () => {
    const password = plainToInstance(LoginDto, {
      email: 'player@example.com',
      password: 'x'.repeat(73),
    });
    const kills = plainToInstance(UpdateBestiaryProgressDto, {
      kills: 1_000_001,
    });
    const level = plainToInstance(CreateCharacterDto, {
      name: 'Rune',
      vocation: 'EK',
      world: 'Antica',
      level: 10000,
    });
    expect(await validate(password)).not.toHaveLength(0);
    expect(await validate(kills)).not.toHaveLength(0);
    expect(await validate(level)).not.toHaveLength(0);
    const huntsDto = readFileSync(
      join(__dirname, '..', 'hunts', 'dto', 'list-hunts-query.dto.ts'),
      'utf8',
    );
    expect(huntsDto).toContain('@MaxLength(80)');
    expect(huntsDto).toContain('@Max(9999)');
    expect(new CatalogSlugPipe().transform('ancient-temple-rotworms')).toBe(
      'ancient-temple-rotworms',
    );
    expect(() => new CatalogSlugPipe().transform('../secret')).toThrow(
      BadRequestException,
    );
  });

  it('returns 429 after the configured window is exhausted', () => {
    const limiter = new RateLimitService();
    for (let i = 0; i < 10; i += 1) {
      limiter.consume('login:ip', 10, 60_000);
    }
    expect(() => limiter.consume('login:ip', 10, 60_000)).toThrow(
      HttpException,
    );
    try {
      limiter.consume('login:ip', 10, 60_000);
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
    }
  });

  it('limits login, register and forum writes on the server', () => {
    const auth = readFileSync(
      join(__dirname, '..', 'auth', 'auth.controller.ts'),
      'utf8',
    );
    const forum = readFileSync(
      join(__dirname, '..', 'forum', 'forum.controller.ts'),
      'utf8',
    );
    expect(auth).toContain('RATE_LIMITS.login');
    expect(auth).toContain('RATE_LIMITS.register');
    expect(auth).toContain("scope: 'ip'");
    expect(forum).toContain('RATE_LIMITS.forumWrite');
    expect(forum).toContain("scope: 'user'");
    expect(RATE_LIMIT_KEY).toBe('rateLimit');
  });

  it('hides internal failures from the client and keeps the cause in the log', () => {
    const json = jest.fn();
    const response = { status: jest.fn(() => ({ json })) };
    const host = {
      switchToHttp: () => ({ getResponse: () => response }),
    };
    const logged = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const failure = new Error(
      [
        'Invalid prisma.hunt.findMany() invocation',
        'authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature',
        'postgres://user:secret@host/db',
        'Inconsistent query result: Field creature is required',
      ].join('\n'),
    );
    failure.stack = [
      'Error: hidden query',
      '    at HuntsService.findAll (/app/apps/api/dist/hunts/hunts.service.js:140:15)',
      '    at PrismaClient.handleRequestError (/app/node_modules/@prisma/client/runtime.js:1:1)',
      '    at SafeExceptionFilter.catch (/app/apps/api/dist/common/safe-exception.filter.js:29:5)',
    ].join('\n');
    Object.assign(failure, { code: 'P2022' });
    new SafeExceptionFilter().catch(failure, host as never);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
    });
    expect(JSON.stringify(json.mock.calls)).not.toContain('secret');
    expect(JSON.stringify(json.mock.calls)).not.toContain('postgres://');
    expect(JSON.stringify(json.mock.calls)).not.toContain('Bearer');
    const summary = loggedErrorSummary(failure);
    const stack = loggedErrorStack(failure);
    expect(logged).toHaveBeenCalledWith(summary, stack);
    expect(summary).toContain('Error');
    expect(summary).toContain('P2022');
    expect(summary).toContain(
      'Inconsistent query result: Field creature is required',
    );
    expect(summary).not.toContain('secret');
    expect(summary).not.toContain('postgres://');
    expect(summary).not.toContain('Bearer');
    expect(summary).not.toContain('eyJ');
    expect(stack).toContain('hunts.service.js:140:15');
    expect(stack).toContain('safe-exception.filter.js:29:5');
    expect(stack).not.toContain('node_modules');
    expect(stack).not.toContain('hidden query');
    logged.mockRestore();
  });

  it('does not build the admin panel with innerHTML', () => {
    const ui = join(__dirname, '..', 'admin', 'admin-ui');
    for (const file of ['index.html', 'login.html']) {
      const html = readFileSync(join(ui, file), 'utf8');
      expect(html).not.toContain('innerHTML');
      expect(html).not.toContain('dangerouslySetInnerHTML');
      expect(html).toContain('textContent');
    }
  });
});

describe('AdminPageAccess', () => {
  const auth = { authenticate: jest.fn() };
  const prisma = { user: { findUnique: jest.fn() } };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  async function access() {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminPageAccess,
        { provide: AuthService, useValue: auth },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    return moduleRef.get(AdminPageAccess);
  }

  it('blocks anonymous, non-admin and accepts admin', async () => {
    const service = await access();
    await expect(service.resolve({ headers: {} } as never)).resolves.toBe(
      'anonymous',
    );

    auth.authenticate.mockResolvedValue({
      userId: 'user-1',
      email: 'user@email.com',
      sessionId: 'session-1',
    });
    prisma.user.findUnique.mockResolvedValue({ role: 'USER' });
    await expect(
      service.resolve({
        headers: { authorization: 'Bearer token', cookie: undefined },
      } as never),
    ).resolves.toBe('forbidden');

    prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    await expect(
      service.resolve({
        headers: { cookie: 'rc_admin=admin-token' },
      } as never),
    ).resolves.toBe('ok');
  });
});

describe('admin dashboard gate', () => {
  it('redirects anonymous users and rejects non-admins', async () => {
    const access = {
      resolve: jest.fn(),
      setSession: jest.fn(),
      clearSession: jest.fn(),
    };
    const controller = new AdminDashboardController(
      access as never,
      {
        authenticate: jest.fn(),
        logout: jest.fn(),
      } as never,
    );
    const res = {
      redirect: jest.fn(),
      status: jest.fn().mockReturnThis(),
      type: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    access.resolve.mockResolvedValue('anonymous');
    await controller.dashboard({} as never, res as never);
    expect(res.redirect).toHaveBeenCalledWith(302, '/admin/login');

    access.resolve.mockResolvedValue('forbidden');
    await controller.dashboard({} as never, res as never);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.send).toHaveBeenCalledWith('Admin access required');
  });
});
