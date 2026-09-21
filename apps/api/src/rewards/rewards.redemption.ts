export const USER_REDEMPTION_MESSAGES = {
  PENDING: 'Resgate solicitado. Seu pedido está aguardando aprovação.',
  APPROVED: 'Resgate aprovado. A entrega será realizada em breve.',
  DELIVERED: 'Reward entregue.',
  CANCELLED: 'Resgate cancelado.',
} as const;

export type RedemptionStatusCode = keyof typeof USER_REDEMPTION_MESSAGES;

export function userRedemptionMessage(status: string) {
  return (
    USER_REDEMPTION_MESSAGES[status as RedemptionStatusCode] ??
    USER_REDEMPTION_MESSAGES.PENDING
  );
}
