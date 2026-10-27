import { createTicketProtocol, normalizeSearchTerm } from './admin-text';

describe('admin text helpers', () => {
  it('builds a stable protocol shape', () => {
    expect(createTicketProtocol(Buffer.alloc(10, 1))).toMatch(
      /^RC-[A-Z0-9]{10}$/,
    );
  });

  it('minimizes search terms and drops email-like input', () => {
    expect(normalizeSearchTerm('  Asuras   ')).toBe('asuras');
    expect(normalizeSearchTerm('a')).toBeNull();
    expect(normalizeSearchTerm('hunter@example.com')).toBeNull();
  });
});
