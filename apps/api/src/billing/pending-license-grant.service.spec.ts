import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminAuditService } from '../audit/admin-audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { PendingLicenseGrantService } from './pending-license-grant.service';

describe('PendingLicenseGrantService', () => {
  const pending: Array<Record<string, unknown>> = [];
  const licenses: Array<Record<string, unknown>> = [];
  const grants: Array<Record<string, unknown>> = [];
  const audits: Array<Record<string, unknown>> = [];
  let users: Array<{ id: string; email: string }> = [];

  const prisma = {
    user: {
      findUnique: async ({ where }: { where: { email?: string; id?: string } }) =>
        users.find((user) =>
          where.email ? user.email === where.email : user.id === where.id,
        ) ?? null,
    },
    billingProduct: {
      findUnique: async () => ({ id: 'product-1', active: true }),
    },
    billingPendingLicenseGrant: {
      findFirst: async ({
        where,
      }: {
        where: { emailNormalized: string; status: string };
      }) =>
        pending.find(
          (row) =>
            row.emailNormalized === where.emailNormalized &&
            row.status === where.status,
        ) ?? null,
      findMany: async ({
        where,
      }: {
        where: { emailNormalized?: string; status?: string };
      }) =>
        pending.filter((row) => {
          if (
            where.emailNormalized &&
            row.emailNormalized !== where.emailNormalized
          )
            return false;
          if (where.status && row.status !== where.status) return false;
          return true;
        }),
      findUnique: async ({ where }: { where: { id: string } }) =>
        pending.find((row) => row.id === where.id) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: `pending-${pending.length + 1}`,
          createdAt: new Date('2026-10-27T00:00:00.000Z'),
          claimedUserId: null,
          claimedLicenseId: null,
          claimedAt: null,
          cancelledAt: null,
          cancelReason: null,
          ...data,
        };
        pending.push(row);
        return row;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        const matches = pending.filter((row) => {
          if (where.id && row.id !== where.id) return false;
          if (where.status && row.status !== where.status) return false;
          if (
            where.emailNormalized &&
            row.emailNormalized !== where.emailNormalized
          )
            return false;
          const expiresFilter = where.offerExpiresAt as
            | { lte?: Date; gt?: Date }
            | undefined;
          if (expiresFilter?.lte) {
            const expires = row.offerExpiresAt as Date | null;
            if (!expires || expires.getTime() > expiresFilter.lte.getTime()) {
              return false;
            }
          }
          return true;
        });
        for (const row of matches) Object.assign(row, data);
        return { count: matches.length };
      },
      count: async () => pending.length,
    },
    billingLicense: {
      findFirst: async () =>
        licenses.find((row) => row.status === 'ACTIVE' || row.status === 'SUSPENDED') ??
        null,
      updateMany: async () => ({ count: 0 }),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: `license-${licenses.length + 1}`,
          orderId: null,
          ...data,
        };
        licenses.push(row);
        return row;
      },
    },
    billingLicenseGrant: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `grant-${grants.length + 1}`, ...data };
        grants.push(row);
        return row;
      },
    },
    $transaction: async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
  };

  let service: PendingLicenseGrantService;

  beforeEach(async () => {
    pending.length = 0;
    licenses.length = 0;
    grants.length = 0;
    audits.length = 0;
    users = [];
    const moduleRef = await Test.createTestingModule({
      providers: [
        PendingLicenseGrantService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: AdminAuditService,
          useValue: {
            record: (input: Record<string, unknown>) => audits.push(input),
          },
        },
      ],
    }).compile();
    service = moduleRef.get(PendingLicenseGrantService);
  });

  it('schedules a pending grant without creating a license or payment', async () => {
    const row = await service.schedule('admin-1', {
      email: 'New.Partner@Example.com',
      term: 'LIFETIME',
      category: 'PARTNERSHIP',
      reason: 'Parceria de lançamento do app',
    });
    expect(row).toMatchObject({
      email: 'new.partner@example.com',
      status: 'PENDING',
      category: 'PARTNERSHIP',
    });
    expect(licenses).toHaveLength(0);
    expect(audits[0]).toMatchObject({ action: 'license.pending_grant' });
  });

  it('refuses a pending grant when the account already exists', async () => {
    users = [{ id: 'user-1', email: 'ada@example.com' }];
    await expect(
      service.schedule('admin-1', {
        email: 'ada@example.com',
        term: 'LIFETIME',
        category: 'OTHER',
        reason: 'Tentativa indevida de bypass',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(pending).toHaveLength(0);
  });

  it('claims the pending offer only after the matching email authenticates', async () => {
    await service.schedule('admin-1', {
      email: 'friend@example.com',
      term: 'FIXED',
      durationDays: 30,
      category: 'CONTENT_CREATOR',
      reason: 'Criador convidado da campanha',
    });
    users = [{ id: 'user-2', email: 'friend@example.com' }];

    await expect(
      service.claimForAuthenticatedUser('user-2', 'other@example.com'),
    ).resolves.toEqual({ claimed: 0 });
    expect(licenses).toHaveLength(0);

    await expect(
      service.claimForAuthenticatedUser('user-2', 'friend@example.com'),
    ).resolves.toEqual({ claimed: 1 });
    expect(licenses).toHaveLength(1);
    expect(licenses[0]).toMatchObject({
      userId: 'user-2',
      orderId: null,
      source: 'ADMIN_GRANT',
      status: 'ACTIVE',
    });
    expect(grants[0]).toMatchObject({ category: 'CONTENT_CREATOR' });
    expect(pending[0]).toMatchObject({ status: 'CLAIMED', claimedUserId: 'user-2' });
    expect(audits.some((item) => item.action === 'license.pending_claim')).toBe(
      true,
    );
  });
});
