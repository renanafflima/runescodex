import type { BillingEventTypeCode } from './billing.constants';

export function mapMercadoPagoStatus(
  status: string,
): BillingEventTypeCode | null {
  switch (status) {
    case 'pending':
    case 'in_process':
    case 'in_mediation':
    case 'authorized':
      return 'PAYMENT_PENDING';
    case 'approved':
      return 'PAYMENT_PAID';
    case 'rejected':
    case 'cancelled':
      return 'PAYMENT_FAILED';
    case 'refunded':
    case 'charged_back':
      return 'PAYMENT_REFUNDED';
    default:
      return null;
  }
}
