import { mapMercadoPagoStatus } from './mercado-pago.status';

describe('Mercado Pago status mapping', () => {
  it('keeps pending and rejected payments from looking approved', () => {
    expect(mapMercadoPagoStatus('pending')).toBe('PAYMENT_PENDING');
    expect(mapMercadoPagoStatus('in_process')).toBe('PAYMENT_PENDING');
    expect(mapMercadoPagoStatus('rejected')).toBe('PAYMENT_FAILED');
    expect(mapMercadoPagoStatus('cancelled')).toBe('PAYMENT_FAILED');
    expect(mapMercadoPagoStatus('approved')).toBe('PAYMENT_PAID');
  });

  it('treats refund and chargeback as financial reversal', () => {
    expect(mapMercadoPagoStatus('refunded')).toBe('PAYMENT_REFUNDED');
    expect(mapMercadoPagoStatus('charged_back')).toBe('PAYMENT_REFUNDED');
    expect(mapMercadoPagoStatus('in_mediation')).toBe('PAYMENT_PENDING');
  });

  it('ignores an unknown provider status', () => {
    expect(mapMercadoPagoStatus('mystery')).toBeNull();
  });
});
