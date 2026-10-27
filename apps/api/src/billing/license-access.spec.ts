import { effectiveLicenseStatus, licenseGrantsAccess } from './license-access';

describe('license access', () => {
  const now = new Date('2026-10-20T12:00:00.000Z');

  it('allows a lifetime active license and blocks the other states', () => {
    expect(
      licenseGrantsAccess({ status: 'ACTIVE', expiresAt: null }, now),
    ).toBe(true);
    expect(
      licenseGrantsAccess({ status: 'SUSPENDED', expiresAt: null }, now),
    ).toBe(false);
    expect(
      licenseGrantsAccess({ status: 'REVOKED', expiresAt: null }, now),
    ).toBe(false);
    expect(
      licenseGrantsAccess(
        { status: 'ACTIVE', expiresAt: new Date('2026-10-01T00:00:00.000Z') },
        now,
      ),
    ).toBe(false);
    expect(
      effectiveLicenseStatus(
        { status: 'ACTIVE', expiresAt: new Date('2026-10-01T00:00:00.000Z') },
        now,
      ),
    ).toBe('EXPIRED');
  });
});
