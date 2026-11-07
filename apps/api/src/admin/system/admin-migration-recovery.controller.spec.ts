import { GUARDS_METADATA } from '@nestjs/common/constants';

jest.mock('@nestjs/passport', () => ({
  AuthGuard: () =>
    class {
      canActivate() {
        return true;
      }
    },
}));

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../admin.guard';
import { AdminMigrationRecoveryController } from './admin-migration-recovery.controller';

describe('AdminMigrationRecoveryController', () => {
  it('protects routes with JwtAuthGuard and AdminGuard', () => {
    const metadata: unknown = Reflect.getMetadata(
      GUARDS_METADATA,
      AdminMigrationRecoveryController,
    );
    expect(metadata).toEqual(
      expect.arrayContaining([JwtAuthGuard, AdminGuard]),
    );
  });
});
