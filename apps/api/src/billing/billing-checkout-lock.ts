/**
 * PostgreSQL transactional advisory lock for Checkout Pro reservation.
 *
 * Namespace 0x52430001 ("RC" + checkout family) is fixed so other RuneCodex
 * locks can occupy different namespaces without overlapping this one.
 *
 * The user key is a deterministic signed 32-bit FNV-1a of userId. Hash
 * collisions only extra-serialize unrelated users; reservation rows remain
 * filtered by the real userId, so integrity is preserved.
 *
 * The lock is acquired with pg_advisory_xact_lock inside a Prisma transaction
 * and is released automatically when that transaction ends. Callers must not
 * keep the transaction open across HTTP.
 */
export const CHECKOUT_ADVISORY_LOCK_NAMESPACE = 0x5243_0001;

export type CheckoutLockTx = {
  $executeRaw: (
    query: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<unknown>;
};

export function checkoutLockUserKey(userId: string): number {
  let hash = 2166136261;
  for (const byte of Buffer.from(userId, 'utf8')) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return hash | 0;
}

export async function acquireCheckoutUserLock(
  tx: CheckoutLockTx,
  userId: string,
): Promise<void> {
  const userKey = checkoutLockUserKey(userId);
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      ${CHECKOUT_ADVISORY_LOCK_NAMESPACE}::int4,
      ${userKey}::int4
    )
  `;
}
