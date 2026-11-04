import {
  CHECKOUT_ADVISORY_LOCK_NAMESPACE,
  acquireCheckoutUserLock,
  checkoutLockUserKey,
} from './billing-checkout-lock';

describe('checkout advisory lock', () => {
  it('uses a documented namespace and a deterministic user key', () => {
    expect(CHECKOUT_ADVISORY_LOCK_NAMESPACE).toBe(0x5243_0001);
    expect(checkoutLockUserKey('user-a')).toBe(checkoutLockUserKey('user-a'));
    expect(checkoutLockUserKey('user-a')).not.toBe(
      checkoutLockUserKey('user-b'),
    );
  });

  it('requests a transactional PostgreSQL lock and never a session lock', async () => {
    const executeRaw = jest.fn(async () => 1);
    await acquireCheckoutUserLock({ $executeRaw: executeRaw }, 'user-1');

    const [strings, namespace, userKey] = executeRaw.mock.calls[0];
    expect(strings.join(' ')).toMatch(/pg_advisory_xact_lock/);
    expect(strings.join(' ')).not.toMatch(/pg_advisory_lock\(/);
    expect(namespace).toBe(CHECKOUT_ADVISORY_LOCK_NAMESPACE);
    expect(userKey).toBe(checkoutLockUserKey('user-1'));
  });

  it('treats hash collisions as extra serialization without mixing user rows', () => {
    const seen = new Map<number, string>();
    let left = '';
    let right = '';
    for (let index = 0; index < 400_000; index += 1) {
      const candidate = crypto.randomUUID();
      const key = checkoutLockUserKey(candidate);
      const previous = seen.get(key);
      if (previous) {
        left = previous;
        right = candidate;
        break;
      }
      seen.set(key, candidate);
    }
    expect(left).not.toBe('');
    expect(right).not.toBe(left);
    expect(checkoutLockUserKey(left)).toBe(checkoutLockUserKey(right));
  });
});
