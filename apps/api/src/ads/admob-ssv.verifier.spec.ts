import {
  extractSignedContent,
  parseAdMobSsvQuery,
  resetAdMobVerifierKeyCacheForTests,
} from './admob-ssv.verifier';

describe('AdMob SSV verifier', () => {
  afterEach(() => {
    resetAdMobVerifierKeyCacheForTests();
  });

  it('extracts signed payload before signature and key_id', () => {
    const query =
      'ad_unit=2747237135&transaction_id=abc&custom_data=sess-1&signature=AAA&key_id=42';
    const extracted = extractSignedContent(query);
    expect(extracted.toSign).toBe(
      'ad_unit=2747237135&transaction_id=abc&custom_data=sess-1',
    );
    expect(extracted.signatureEncoded).toBe('AAA');
    expect(extracted.keyId).toBe(42);
  });

  it('rejects query strings without trailing signature/key_id', () => {
    expect(() => extractSignedContent('ad_unit=1&transaction_id=2')).toThrow(
      /signature/,
    );
  });

  it('parses required SSV fields', () => {
    const query =
      'ad_unit=2747237135&transaction_id=abc&custom_data=sess-1&signature=AAA&key_id=42';
    const parsed = parseAdMobSsvQuery(query);
    expect(parsed.adUnit).toBe('2747237135');
    expect(parsed.transactionId).toBe('abc');
    expect(parsed.customData).toBe('sess-1');
    expect(parsed.keyId).toBe(42);
  });
});
