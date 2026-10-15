import { decimalToMinorUnits, minorUnitsToDecimal } from './mercado-pago.money';

describe('Mercado Pago amounts', () => {
  it('converts the official premium price without a float catalog', () => {
    expect(minorUnitsToDecimal(4990)).toBe(49.9);
    expect(decimalToMinorUnits(49.9)).toBe(4990);
    expect(decimalToMinorUnits(49.9)).not.toBe(1499);
  });

  it('rejects amounts that are not exact cents', () => {
    expect(decimalToMinorUnits(Number.NaN)).toBeNull();
    expect(decimalToMinorUnits(0)).toBeNull();
  });
});
