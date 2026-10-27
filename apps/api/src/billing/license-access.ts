export type LicenseClock = {
  status: string;
  expiresAt?: Date | null;
};

export function licenseGrantsAccess(license: LicenseClock, now = new Date()) {
  if (license.status !== 'ACTIVE') {
    return false;
  }
  if (!license.expiresAt) {
    return true;
  }
  return license.expiresAt.getTime() > now.getTime();
}

export function effectiveLicenseStatus(
  license: LicenseClock,
  now = new Date(),
) {
  if (
    license.status === 'ACTIVE' &&
    license.expiresAt &&
    license.expiresAt.getTime() <= now.getTime()
  ) {
    return 'EXPIRED';
  }
  return license.status;
}

export type VoucherClock = {
  status: string;
  startsAt: Date;
  endsAt?: Date | null;
  redeemedCount: number;
  maxRedemptions: number;
};

export function effectiveVoucherStatus(
  voucher: VoucherClock,
  now = new Date(),
) {
  if (
    voucher.status === 'PAUSED' ||
    voucher.status === 'CLOSED' ||
    voucher.status === 'EXHAUSTED'
  ) {
    return voucher.status;
  }
  if (voucher.endsAt && voucher.endsAt.getTime() <= now.getTime()) {
    return 'EXPIRED';
  }
  if (voucher.redeemedCount >= voucher.maxRedemptions) {
    return 'EXHAUSTED';
  }
  if (voucher.startsAt.getTime() > now.getTime()) {
    return 'SCHEDULED';
  }
  return 'ACTIVE';
}
