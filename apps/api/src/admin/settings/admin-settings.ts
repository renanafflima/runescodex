export const ADMIN_SETTING_KEYS = [
  'sla.firstResponseMinutes',
  'sla.resolutionMinutes',
  'sla.unassignedHours',
  'alert.usageDropPercent',
  'alert.staleContentDays',
] as const;

export type AdminSettingKey = (typeof ADMIN_SETTING_KEYS)[number];

type SettingRule = {
  unit: 'minutes' | 'hours' | 'days' | 'percent';
  min: number;
  max: number;
  label: string;
  definition: string;
};

export const ADMIN_SETTING_RULES: Record<AdminSettingKey, SettingRule> = {
  'sla.firstResponseMinutes': {
    unit: 'minutes',
    min: 15,
    max: 43_200,
    label: 'Primeira resposta',
    definition:
      'Minutos corridos entre a abertura do chamado e a primeira resposta pública. Notas internas não contam.',
  },
  'sla.resolutionMinutes': {
    unit: 'minutes',
    min: 15,
    max: 43_200,
    label: 'Resolução',
    definition:
      'Minutos corridos entre a abertura e a resolução ou rejeição. Não há calendário de horário comercial.',
  },
  'sla.unassignedHours': {
    unit: 'hours',
    min: 1,
    max: 720,
    label: 'Sem responsável',
    definition:
      'Horas corridas que um chamado aberto pode ficar sem responsável antes de gerar alerta.',
  },
  'alert.usageDropPercent': {
    unit: 'percent',
    min: 10,
    max: 90,
    label: 'Queda de uso',
    definition:
      'Queda percentual de visualizações de Hunts entre dois períodos totalmente instrumentados.',
  },
  'alert.staleContentDays': {
    unit: 'days',
    min: 30,
    max: 3_650,
    label: 'Conteúdo sem atualização',
    definition:
      'Dias corridos desde a última atualização de uma Hunt ativa. Não significa que o conteúdo esteja incorreto.',
  },
};

export function isAdminSettingKey(value: string): value is AdminSettingKey {
  return ADMIN_SETTING_KEYS.includes(value as AdminSettingKey);
}

export function readSettingAmount(value: unknown) {
  if (!value || typeof value !== 'object' || !('amount' in value)) return null;
  const amount = (value as { amount?: unknown }).amount;
  return typeof amount === 'number' && Number.isInteger(amount) ? amount : null;
}

export function assertSettingAmount(key: AdminSettingKey, amount: number) {
  const rule = ADMIN_SETTING_RULES[key];
  if (!Number.isInteger(amount) || amount < rule.min || amount > rule.max) {
    return `${rule.label} precisa estar entre ${rule.min} e ${rule.max}.`;
  }
  return null;
}
