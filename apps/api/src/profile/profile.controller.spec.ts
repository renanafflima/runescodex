import { Test } from '@nestjs/testing';

jest.mock('@nestjs/passport', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const common = require('@nestjs/common') as typeof import('@nestjs/common');
  return {
    AuthGuard: () =>
      class {
        canActivate(): never {
          throw new common.UnauthorizedException();
        }
      },
  };
});

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PremiumGuard } from '../billing/premium.guard';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

describe('ProfileController', () => {
  let controller: ProfileController;
  const profileService = {
    getMe: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [ProfileController],
      providers: [{ provide: ProfileService, useValue: profileService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PremiumGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(ProfileController);
  });

  it('delegates /profile/me to ProfileService with the authenticated user id', async () => {
    const payload = { memberSince: '2025-01-01T00:00:00.000Z' };
    profileService.getMe.mockResolvedValue(payload);

    const result = await controller.me({
      userId: 'jwt-user',
      email: 'ada@runescodex.com',
      sessionId: 'session-1',
    });

    expect(profileService.getMe).toHaveBeenCalledWith('jwt-user');
    expect(profileService.getMe).toHaveBeenCalledTimes(1);
    expect(result).toBe(payload);
  });
});
