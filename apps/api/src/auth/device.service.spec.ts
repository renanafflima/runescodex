import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminAuditService } from '../audit/admin-audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { DEVICE_LIMIT_MESSAGE, DeviceService } from './device.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

type DeviceRow = {
  id: string;
  userId: string;
  installationId: string;
  publicKeyHash: string;
  publicKeySpki: string;
  label: string;
  deviceType: string | null;
  osName: string | null;
  clientName: string | null;
  status: 'ACTIVE' | 'REVOKED';
  slot: number | null;
  createdAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
};

type ChallengeRow = {
  id: string;
  installationId: string;
  publicKeyHash: string;
  publicKeySpki: string;
  nonce: string;
  expiresAt: Date;
  usedAt: Date | null;
};

type SessionRow = { id: string; userId: string; deviceId: string | null };

describe('DeviceService', () => {
  const devices: DeviceRow[] = [];
  const challenges: ChallengeRow[] = [];
  const sessions: SessionRow[] = [];
  const audits: Array<Record<string, unknown>> = [];
  const users = new Map<string, { passwordHash: string | null }>([
    ['user-1', { passwordHash: 'hashed' }],
    ['user-2', { passwordHash: null }],
    ['user-3', { passwordHash: 'hashed' }],
  ]);
  let deviceSeq = 0;
  let queue = Promise.resolve();
  let locked = 0;

  function matches(
    row: Record<string, unknown>,
    where: Record<string, unknown>,
  ): boolean {
    return Object.entries(where).every(([key, expected]) => {
      if (expected && typeof expected === 'object' && 'gt' in expected) {
        return (
          (row[key] as Date).getTime() > (expected as { gt: Date }).gt.getTime()
        );
      }
      return row[key] === expected;
    });
  }

  const tx = {
    $queryRaw: jest.fn(async () => {
      locked += 1;
      return [{ id: 'user-1' }];
    }),
    authDeviceChallenge: {
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; usedAt: null; expiresAt: { gt: Date } };
        data: { usedAt: Date };
      }) => {
        const row = challenges.find(
          (item) =>
            item.id === where.id &&
            item.usedAt === null &&
            item.expiresAt > where.expiresAt.gt,
        );
        if (!row) return { count: 0 };
        row.usedAt = data.usedAt;
        return { count: 1 };
      },
    },
    authDevice: {
      findUnique: async ({
        where,
      }: {
        where: {
          userId_installationId: { userId: string; installationId: string };
        };
      }) =>
        devices.find(
          (item) =>
            item.userId === where.userId_installationId.userId &&
            item.installationId === where.userId_installationId.installationId,
        ) ?? null,
      findMany: async ({
        where,
      }: {
        where: { userId: string; status: string };
      }) =>
        devices.filter(
          (item) =>
            item.userId === where.userId && item.status === where.status,
        ),
      findFirst: async ({
        where,
      }: {
        where: { id: string; userId: string; status: string };
      }) =>
        devices.find(
          (item) =>
            item.id === where.id &&
            item.userId === where.userId &&
            item.status === where.status,
        ) ?? null,
      create: async ({ data }: { data: DeviceRow }) => {
        const activeSlot = devices.find(
          (item) =>
            item.userId === data.userId &&
            item.status === 'ACTIVE' &&
            item.slot === data.slot,
        );
        if (activeSlot) {
          const error = new Error('unique') as Error & { code: string };
          error.code = 'P2002';
          throw error;
        }
        deviceSeq += 1;
        const row: DeviceRow = {
          id: `device-${deviceSeq}`,
          status: 'ACTIVE',
          createdAt: new Date(),
          lastSeenAt: new Date(),
          revokedAt: null,
          deviceType: data.deviceType ?? null,
          osName: data.osName ?? null,
          clientName: data.clientName ?? null,
          ...data,
        };
        devices.push(row);
        return row;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<DeviceRow>;
      }) => {
        const row = devices.find((item) => item.id === where.id);
        if (!row) throw new Error('missing');
        Object.assign(row, data);
        return row;
      },
    },
    authSession: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        sessions.find((item) => item.id === where.id) ?? null,
      deleteMany: async ({ where }: { where: { deviceId: string } }) => {
        const before = sessions.length;
        for (let index = sessions.length - 1; index >= 0; index -= 1) {
          if (sessions[index]?.deviceId === where.deviceId)
            sessions.splice(index, 1);
        }
        return { count: before - sessions.length };
      },
    },
  };

  const prisma = {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const user = users.get(where.id);
        return user ? { id: where.id, passwordHash: user.passwordHash } : null;
      },
    },
    authDeviceChallenge: {
      deleteMany: async () => ({ count: 0 }),
      create: async ({ data }: { data: ChallengeRow }) => {
        challenges.push({ ...data, usedAt: null });
        return challenges[challenges.length - 1];
      },
      findUnique: async ({ where }: { where: { id: string } }) =>
        challenges.find((item) => item.id === where.id) ?? null,
      updateMany: tx.authDeviceChallenge.updateMany,
    },
    authDevice: {
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        devices.filter((item) =>
          matches(item as unknown as Record<string, unknown>, where),
        ),
    },
    authSession: {
      findUnique: async ({
        where,
        include,
      }: {
        where: { id: string };
        include?: { device?: boolean };
      }) => {
        const row = sessions.find((item) => item.id === where.id) ?? null;
        if (!row || !include?.device) return row;
        return {
          ...row,
          device: devices.find((item) => item.id === row.deviceId) ?? null,
        };
      },
    },
    $transaction: (fn: (client: typeof tx) => Promise<unknown>) => {
      const run = queue.then(() => fn(tx));
      queue = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
  };

  let service: DeviceService;

  beforeEach(async () => {
    devices.length = 0;
    challenges.length = 0;
    sessions.length = 0;
    audits.length = 0;
    deviceSeq = 0;
    locked = 0;
    queue = Promise.resolve();
    const moduleRef = await Test.createTestingModule({
      providers: [
        DeviceService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: AdminAuditService,
          useValue: {
            record: (input: Record<string, unknown>) => audits.push(input),
          },
        },
      ],
    }).compile();
    service = moduleRef.get(DeviceService);
  });

  async function identity(installationId: string) {
    const pair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign'],
    );
    const spki = Buffer.from(
      await crypto.subtle.exportKey('spki', pair.publicKey),
    ).toString('base64');
    return { pair, spki, installationId };
  }

  async function proofFor(
    installationId = crypto.randomUUID(),
    label = 'Chrome · Windows',
  ) {
    const current = await identity(installationId);
    const challenge = await service.createChallenge(
      current.installationId,
      current.spki,
    );
    const signature = Buffer.from(
      await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        current.pair.privateKey,
        new TextEncoder().encode(challenge.nonce),
      ),
    ).toString('base64');
    return {
      current,
      proof: {
        installationId: current.installationId,
        challengeId: challenge.challengeId,
        signature,
        label,
        deviceType: 'desktop' as const,
        osName: 'Windows',
        clientName: 'Chrome',
      },
    };
  }

  function codeOf(error: unknown) {
    return error instanceof ForbiddenException ||
      error instanceof UnauthorizedException ||
      error instanceof ConflictException
      ? (error.getResponse() as { code?: string }).code
      : '';
  }

  it('links the first and second device and blocks the third', async () => {
    const first = await proofFor();
    const second = await proofFor();
    const third = await proofFor();
    await expect(service.claim('user-1', first.proof)).resolves.toBe(
      'device-1',
    );
    await expect(service.claim('user-1', second.proof)).resolves.toBe(
      'device-2',
    );
    await expect(service.claim('user-1', third.proof)).rejects.toMatchObject({
      response: { code: 'DEVICE_LIMIT', message: DEVICE_LIMIT_MESSAGE },
    });
    expect(devices.filter((item) => item.status === 'ACTIVE')).toHaveLength(2);
    expect(audits.some((item) => item.action === 'device.linked')).toBe(true);
    expect(audits.some((item) => item.action === 'device.limit')).toBe(true);
    expect(locked).toBeGreaterThanOrEqual(3);
    expect(JSON.stringify(devices)).not.toMatch(/private/i);
  });

  it('does not consume a second slot when the same device signs in again', async () => {
    const first = await proofFor(crypto.randomUUID(), 'Notebook');
    await service.claim('user-1', first.proof);
    const again = await proofFor(first.current.installationId);
    again.current.spki = first.current.spki;
    again.current.pair = first.current.pair;
    const challenge = await service.createChallenge(
      first.current.installationId,
      first.current.spki,
    );
    const signature = Buffer.from(
      await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        first.current.pair.privateKey,
        new TextEncoder().encode(challenge.nonce),
      ),
    ).toString('base64');
    await expect(
      service.claim('user-1', {
        ...first.proof,
        challengeId: challenge.challengeId,
        signature,
      }),
    ).resolves.toBe('device-1');
    expect(devices.filter((item) => item.status === 'ACTIVE')).toHaveLength(1);
  });

  it('frees a slot when a device is removed and revokes only its sessions', async () => {
    const first = await proofFor();
    const second = await proofFor();
    const firstId = await service.claim('user-1', first.proof);
    const secondId = await service.claim('user-1', second.proof);
    sessions.push(
      { id: 'session-a', userId: 'user-1', deviceId: firstId },
      { id: 'session-b', userId: 'user-1', deviceId: firstId },
      { id: 'session-c', userId: 'user-1', deviceId: secondId },
    );

    await expect(
      service.remove(
        'user-3',
        'session-c',
        firstId,
        { password: 'password1' },
        async () => true,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(devices.find((item) => item.id === firstId)?.status).toBe('ACTIVE');

    await expect(
      service.remove('user-1', 'session-c', firstId, {}, async () => false),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessions).toHaveLength(3);

    const removed = await service.remove(
      'user-1',
      'session-c',
      firstId,
      { password: 'password1' },
      async () => true,
    );
    expect(removed.sessionsRevoked).toBe(2);
    expect(sessions.map((item) => item.id)).toEqual(['session-c']);
    expect(devices.find((item) => item.id === firstId)?.status).toBe('REVOKED');
    expect(audits.some((item) => item.action === 'device.removed')).toBe(true);

    const replacement = await proofFor();
    await expect(service.claim('user-1', replacement.proof)).resolves.toBe(
      'device-3',
    );
    expect(devices.filter((item) => item.status === 'ACTIVE')).toHaveLength(2);
  });

  it('serializes simultaneous new devices and keeps the limit', async () => {
    const proofs = await Promise.all([proofFor(), proofFor(), proofFor()]);
    const results = await Promise.allSettled(
      proofs.map((item) => service.claim('user-1', item.proof)),
    );
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(
      2,
    );
    const rejected = results.find((item) => item.status === 'rejected');
    expect(rejected?.status === 'rejected' && codeOf(rejected.reason)).toBe(
      'DEVICE_LIMIT',
    );
    expect(devices.filter((item) => item.status === 'ACTIVE')).toHaveLength(2);
  });

  it('rejects a replayed proof and a replaced key without opening a slot', async () => {
    const first = await proofFor();
    await service.claim('user-1', first.proof);
    await expect(service.claim('user-1', first.proof)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    const replacement = await identity(first.current.installationId);
    const challenge = await service.createChallenge(
      first.current.installationId,
      replacement.spki,
    );
    const signature = Buffer.from(
      await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        replacement.pair.privateKey,
        new TextEncoder().encode(challenge.nonce),
      ),
    ).toString('base64');
    await expect(
      service.claim('user-1', {
        installationId: first.current.installationId,
        challengeId: challenge.challengeId,
        signature,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(devices.filter((item) => item.status === 'ACTIVE')).toHaveLength(1);
  });

  it('lists only the caller devices and hides key material', async () => {
    const own = await proofFor();
    await service.claim('user-1', own.proof);
    sessions.push({ id: 'session-a', userId: 'user-1', deviceId: 'device-1' });
    const listed = await service.list('user-1', 'session-a');
    expect(listed.active).toBe(1);
    expect(listed.limit).toBe(2);
    expect(listed.items[0]?.current).toBe(true);
    expect(listed.items[0]?.label).toBe('Chrome · Windows');
    expect(JSON.stringify(listed)).not.toMatch(
      /publicKey|passwordHash|signature/i,
    );

    sessions.push({ id: 'session-b', userId: 'user-2', deviceId: null });
    await expect(service.list('user-2', 'session-b')).resolves.toMatchObject({
      active: 0,
      items: [],
    });
  });

  it('requires a current-device signature when the account has no password', async () => {
    const first = await proofFor();
    const deviceId = await service.claim('user-2', first.proof);
    sessions.push({ id: 'session-g', userId: 'user-2', deviceId });
    await expect(
      service.remove('user-2', 'session-g', deviceId, {}, async () => true),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    const challenge = await service.createChallenge(
      first.current.installationId,
      first.current.spki,
    );
    const signature = Buffer.from(
      await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        first.current.pair.privateKey,
        new TextEncoder().encode(challenge.nonce),
      ),
    ).toString('base64');
    await expect(
      service.remove(
        'user-2',
        'session-g',
        deviceId,
        { challengeId: challenge.challengeId, signature },
        async () => true,
      ),
    ).resolves.toMatchObject({ removed: true, current: true });
    expect(sessions).toHaveLength(0);
  });
});
