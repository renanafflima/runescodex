import { generateVoucherCode, hashVoucherCode } from './voucher-code';

describe('voucher codes', () => {
  it('creates an unpredictable code and stores only its hash', () => {
    const first = generateVoucherCode();
    const second = generateVoucherCode();
    expect(first).toMatch(/^RC-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(second).not.toBe(first);
    expect(hashVoucherCode(first)).toHaveLength(64);
    expect(hashVoucherCode(first)).not.toBe(first);
    expect(hashVoucherCode(`  ${first.toLowerCase()}  `)).toBe(
      hashVoucherCode(first),
    );
  });
});
