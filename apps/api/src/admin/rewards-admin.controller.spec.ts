jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('../auth/guards/jwt-auth.guard', () => ({
  JwtAuthGuard: class JwtAuthGuard {},
}));

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RewardsController } from '../rewards/rewards.controller';
import { AdminGuard } from './admin.guard';
import { RewardsAdminController } from './rewards-admin.controller';

describe('admin route protection', () => {
  it('protects RewardsAdminController with Jwt and Admin guards', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      RewardsAdminController,
    ) as unknown[];
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, AdminGuard]));
  });

  it('does not attach AdminGuard to user rewards routes', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      RewardsController,
    ) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).not.toContain(AdminGuard);
  });
});
