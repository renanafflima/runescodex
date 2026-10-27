import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';
import { Prisma } from '../../generated/prisma/client.js';
import { AdminAuditService } from '../audit/admin-audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { readP256PublicKey, verifyP256Signature } from './device-crypto';
import type { DeviceProofDto } from './dto/device-proof.dto';

export const DEVICE_LIMIT = 2;
export const DEVICE_LIMIT_MESSAGE =
  'Sua conta RuneCodex já está vinculada a dois equipamentos. Para entrar neste dispositivo, remova um equipamento existente em Meus equipamentos.';

const CHALLENGE_MS = 2 * 60 * 1000;
const DEVICE_TYPES = new Set(['desktop', 'mobile', 'tablet']);

type ChallengeRow = {
  id: string;
  installationId: string;
  publicKeyHash: string;
  publicKeySpki: string;
  nonce: string;
  expiresAt: Date;
  usedAt: Date | null;
};

@Injectable()
export class DeviceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  async createChallenge(installationId: string, publicKeySpki: string) {
    const key = readP256PublicKey(publicKeySpki);
    if (!key) {
      throw new UnauthorizedException({
        code: 'DEVICE_PROOF_INVALID',
        message:
          'Não foi possível confirmar este equipamento. Tente entrar novamente.',
      });
    }
    const now = new Date();
    await this.prisma.authDeviceChallenge.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    const challenge = await this.prisma.authDeviceChallenge.create({
      data: {
        id: randomUUID(),
        installationId,
        publicKeyHash: key.hash,
        publicKeySpki: key.spki,
        nonce: randomBytes(32).toString('hex'),
        expiresAt: new Date(now.getTime() + CHALLENGE_MS),
      },
    });
    return {
      challengeId: challenge.id,
      nonce: challenge.nonce,
      expiresAt: challenge.expiresAt.toISOString(),
    };
  }

  async claim(userId: string, proof: DeviceProofDto) {
    const challenge = await this.loadFreshChallenge(proof);
    if (
      !verifyP256Signature(
        challenge.publicKeySpki,
        challenge.nonce,
        proof.signature,
      )
    ) {
      await this.audit.record({
        actorUserId: userId,
        action: 'device.proof_failed',
        entityType: 'device',
        entityId: userId,
        summary: 'Assinatura do equipamento rejeitada',
      });
      throw this.invalidProof();
    }
    return this.prisma.$transaction((tx) =>
      this.claimLocked(tx, userId, challenge, proof),
    );
  }

  async list(userId: string, sessionId: string) {
    const [user, session, devices] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true },
      }),
      this.prisma.authSession.findUnique({
        where: { id: sessionId },
        select: { userId: true, deviceId: true },
      }),
      this.prisma.authDevice.findMany({
        where: { userId, status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    if (!user || !session || session.userId !== userId) {
      throw new UnauthorizedException();
    }
    return {
      limit: DEVICE_LIMIT,
      active: devices.length,
      hasPassword: Boolean(user.passwordHash),
      currentDeviceId: session.deviceId,
      items: devices.map((device) => this.present(device, session.deviceId)),
    };
  }

  async listForAdmin(userId: string) {
    const devices = await this.prisma.authDevice.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return devices.map((device) => ({
      ...this.present(device, null),
      revokedAt: device.revokedAt?.toISOString() ?? null,
    }));
  }

  async remove(
    userId: string,
    sessionId: string,
    deviceId: string,
    confirmation: {
      password?: string;
      challengeId?: string;
      signature?: string;
    },
    passwordMatches: (password: string, hash: string) => Promise<boolean>,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) throw new UnauthorizedException();
    if (user.passwordHash) {
      const password = confirmation.password ?? '';
      if (!password || !(await passwordMatches(password, user.passwordHash))) {
        throw new UnauthorizedException(
          'Confirme sua senha para remover o equipamento.',
        );
      }
    } else {
      await this.assertCurrentDeviceSignature(userId, sessionId, confirmation);
    }

    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userId);
      const device = await tx.authDevice.findFirst({
        where: { id: deviceId, userId, status: 'ACTIVE' },
      });
      if (!device) throw new NotFoundException('Equipamento não encontrado.');
      const session = await tx.authSession.findUnique({
        where: { id: sessionId },
        select: { deviceId: true },
      });
      await tx.authDevice.update({
        where: { id: device.id },
        data: { status: 'REVOKED', slot: null, revokedAt: new Date() },
      });
      const revoked = await tx.authSession.deleteMany({
        where: { deviceId: device.id },
      });
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'device.removed',
          entityType: 'device',
          entityId: device.id,
          summary: 'Equipamento desvinculado e sessões revogadas',
          metadata: { sessionsRevoked: revoked.count },
        },
        tx,
      );
      return {
        removed: true,
        sessionsRevoked: revoked.count,
        current: session?.deviceId === device.id,
      };
    });
  }

  private async claimLocked(
    tx: Prisma.TransactionClient,
    userId: string,
    challenge: ChallengeRow,
    proof: DeviceProofDto,
  ) {
    await this.lockUser(tx, userId);
    const consumed = await tx.authDeviceChallenge.updateMany({
      where: {
        id: challenge.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });
    if (consumed.count !== 1) throw this.invalidProof();

    const existing = await tx.authDevice.findUnique({
      where: {
        userId_installationId: {
          userId,
          installationId: challenge.installationId,
        },
      },
    });
    if (existing && existing.publicKeyHash !== challenge.publicKeyHash) {
      throw new ConflictException({
        code: 'DEVICE_KEY_MISMATCH',
        message:
          'Este navegador perdeu a chave do equipamento. Ele será tratado como um equipamento novo.',
      });
    }
    if (existing?.status === 'ACTIVE') {
      await tx.authDevice.update({
        where: { id: existing.id },
        data: { lastSeenAt: new Date() },
      });
      return existing.id;
    }

    const active = await tx.authDevice.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { slot: true },
    });
    if (active.length >= DEVICE_LIMIT) {
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'device.limit',
          entityType: 'device',
          entityId: userId,
          summary: 'Tentativa de vincular um terceiro equipamento',
        },
        tx,
      );
      throw new ForbiddenException({
        code: 'DEVICE_LIMIT',
        message: DEVICE_LIMIT_MESSAGE,
      });
    }
    const used = new Set(active.map((row) => row.slot));
    const slot = [1, 2].find((value) => !used.has(value));
    if (!slot) {
      throw new ForbiddenException({
        code: 'DEVICE_LIMIT',
        message: DEVICE_LIMIT_MESSAGE,
      });
    }
    const hints = this.hints(proof);
    if (existing) {
      await tx.authDevice.update({
        where: { id: existing.id },
        data: {
          status: 'ACTIVE',
          slot,
          revokedAt: null,
          lastSeenAt: new Date(),
          publicKeyHash: challenge.publicKeyHash,
          publicKeySpki: challenge.publicKeySpki,
          ...hints,
        },
      });
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'device.linked',
          entityType: 'device',
          entityId: existing.id,
          summary: 'Equipamento vinculado novamente',
          metadata: { relink: true },
        },
        tx,
      );
      return existing.id;
    }
    try {
      const created = await tx.authDevice.create({
        data: {
          userId,
          installationId: challenge.installationId,
          publicKeyHash: challenge.publicKeyHash,
          publicKeySpki: challenge.publicKeySpki,
          slot,
          ...hints,
        },
      });
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'device.linked',
          entityType: 'device',
          entityId: created.id,
          summary: 'Equipamento vinculado',
        },
        tx,
      );
      return created.id;
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002'
      ) {
        throw new ForbiddenException({
          code: 'DEVICE_LIMIT',
          message: DEVICE_LIMIT_MESSAGE,
        });
      }
      throw error;
    }
  }

  private async assertCurrentDeviceSignature(
    userId: string,
    sessionId: string,
    confirmation: { challengeId?: string; signature?: string },
  ) {
    const session = await this.prisma.authSession.findUnique({
      where: { id: sessionId },
      include: { device: true },
    });
    if (
      !session ||
      session.userId !== userId ||
      !session.device ||
      session.device.status !== 'ACTIVE'
    ) {
      throw new ForbiddenException(
        'Entre novamente neste equipamento antes de gerenciar os vínculos.',
      );
    }
    if (!confirmation.challengeId || !confirmation.signature) {
      throw new UnauthorizedException(
        'Confirme este equipamento para remover o vínculo.',
      );
    }
    const challenge = await this.loadFreshChallenge({
      installationId: session.device.installationId,
      challengeId: confirmation.challengeId,
      signature: confirmation.signature,
    });
    if (
      challenge.publicKeyHash !== session.device.publicKeyHash ||
      !verifyP256Signature(
        session.device.publicKeySpki,
        challenge.nonce,
        confirmation.signature,
      )
    ) {
      throw this.invalidProof();
    }
    const consumed = await this.prisma.authDeviceChallenge.updateMany({
      where: { id: challenge.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (consumed.count !== 1) throw this.invalidProof();
  }

  private async loadFreshChallenge(proof: {
    installationId: string;
    challengeId: string;
    signature: string;
  }) {
    const challenge = await this.prisma.authDeviceChallenge.findUnique({
      where: { id: proof.challengeId },
    });
    if (
      !challenge ||
      challenge.installationId !== proof.installationId ||
      challenge.usedAt ||
      challenge.expiresAt.getTime() <= Date.now()
    ) {
      throw this.invalidProof();
    }
    return challenge;
  }

  private async lockUser(tx: Prisma.TransactionClient, userId: string) {
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`,
    );
  }

  private hints(proof: DeviceProofDto) {
    return {
      label: this.clean(proof.label, 40) ?? 'Navegador',
      deviceType:
        proof.deviceType && DEVICE_TYPES.has(proof.deviceType)
          ? proof.deviceType
          : null,
      osName: this.clean(proof.osName, 40),
      clientName: this.clean(proof.clientName, 40),
    };
  }

  private clean(value: string | undefined, max: number) {
    if (!value) return null;
    const text = value
      .replace(/[\u0000-\u001F\u007F]/g, '')
      .trim()
      .slice(0, max);
    return text || null;
  }

  private present(
    device: {
      id: string;
      label: string;
      deviceType: string | null;
      osName: string | null;
      clientName: string | null;
      status: string;
      createdAt: Date;
      lastSeenAt: Date;
    },
    currentDeviceId: string | null,
  ) {
    return {
      id: device.id,
      label: device.label,
      deviceType: device.deviceType,
      osName: device.osName,
      clientName: device.clientName,
      status: device.status,
      createdAt: device.createdAt.toISOString(),
      lastSeenAt: device.lastSeenAt.toISOString(),
      current: device.id === currentDeviceId,
    };
  }

  private invalidProof() {
    return new UnauthorizedException({
      code: 'DEVICE_PROOF_INVALID',
      message:
        'Não foi possível confirmar este equipamento. Tente entrar novamente.',
    });
  }
}
