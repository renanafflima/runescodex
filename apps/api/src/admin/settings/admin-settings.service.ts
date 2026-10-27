import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdminAuditService } from '../../audit/admin-audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ADMIN_SETTING_KEYS,
  ADMIN_SETTING_RULES,
  assertSettingAmount,
  isAdminSettingKey,
  readSettingAmount,
  type AdminSettingKey,
} from './admin-settings';

@Injectable()
export class AdminSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  async list() {
    const rows = await this.prisma.adminSetting.findMany();
    const stored = new Map(rows.map((row) => [row.key, row]));
    return {
      clock: 'elapsed' as const,
      items: ADMIN_SETTING_KEYS.map((key) => {
        const row = stored.get(key);
        const rule = ADMIN_SETTING_RULES[key];
        return {
          key,
          label: rule.label,
          definition: rule.definition,
          unit: rule.unit,
          min: rule.min,
          max: rule.max,
          amount: row ? readSettingAmount(row.value) : null,
          updatedAt: row?.updatedAt ?? null,
        };
      }),
    };
  }

  async amounts() {
    const rows = await this.prisma.adminSetting.findMany({
      where: { key: { in: [...ADMIN_SETTING_KEYS] } },
    });
    const amounts = new Map<AdminSettingKey, number>();
    for (const row of rows) {
      if (!isAdminSettingKey(row.key)) continue;
      const amount = readSettingAmount(row.value);
      if (amount !== null) amounts.set(row.key, amount);
    }
    return amounts;
  }

  async save(actorId: string, key: string, amount: number) {
    if (!isAdminSettingKey(key)) {
      throw new BadRequestException('Configuração desconhecida.');
    }
    const invalid = assertSettingAmount(key, amount);
    if (invalid) throw new BadRequestException(invalid);
    const current = await this.prisma.adminSetting.findUnique({
      where: { key },
    });
    const saved = await this.prisma.adminSetting.upsert({
      where: { key },
      create: {
        key,
        value: { amount },
        updatedByUserId: actorId,
      },
      update: {
        value: { amount },
        updatedByUserId: actorId,
      },
    });
    await this.audit.record({
      actorUserId: actorId,
      action: 'settings.update',
      entityType: 'admin_setting',
      entityId: key,
      summary: `${ADMIN_SETTING_RULES[key].label}: ${readSettingAmount(current?.value) ?? 'não definido'} → ${amount}`,
      metadata: {
        from: readSettingAmount(current?.value),
        to: amount,
        unit: ADMIN_SETTING_RULES[key].unit,
      },
    });
    return saved;
  }

  async remove(actorId: string, key: string) {
    if (!isAdminSettingKey(key)) {
      throw new BadRequestException('Configuração desconhecida.');
    }
    const current = await this.prisma.adminSetting.findUnique({
      where: { key },
    });
    if (!current) throw new NotFoundException('Configuração não encontrada.');
    await this.prisma.adminSetting.delete({ where: { key } });
    await this.audit.record({
      actorUserId: actorId,
      action: 'settings.remove',
      entityType: 'admin_setting',
      entityId: key,
      summary: `${ADMIN_SETTING_RULES[key].label} removido`,
      metadata: { from: readSettingAmount(current.value) },
    });
    return { removed: true };
  }
}
