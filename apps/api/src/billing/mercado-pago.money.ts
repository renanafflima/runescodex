/** Converts stored minor units to the decimal Mercado Pago expects. 4990 → 49.9 */
export function minorUnitsToDecimal(amountMinor: number): number {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new Error('Amount must be a positive integer in minor units');
  }
  const whole = Math.trunc(amountMinor / 100);
  const fraction = String(amountMinor % 100).padStart(2, '0');
  return Number(`${whole}.${fraction}`);
}

/** Converts a provider decimal back to minor units. Rejects values that are not exact cents. */
export function decimalToMinorUnits(amount: number): number | null {
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  const minor = Math.round((amount + Number.EPSILON) * 100);
  if (!Number.isInteger(minor) || minor <= 0) {
    return null;
  }
  const roundTrip = minorUnitsToDecimal(minor);
  if (Math.abs(roundTrip - amount) > 0.001) {
    return null;
  }
  return minor;
}
