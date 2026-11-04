import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const schema = readFileSync(
  join(__dirname, '../../prisma/schema.prisma'),
  'utf8',
);
const migration = readFileSync(
  join(
    __dirname,
    '../../prisma/migrations/20261103143000_billing_checkout_attempt/migration.sql',
  ),
  'utf8',
);

function modelBody(name: string) {
  const match = schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`));
  if (!match) {
    throw new Error(`model ${name} not found`);
  }
  return match[1];
}

describe('BillingCheckoutAttempt persistence contract', () => {
  it('declares every durable checkout attempt state in Prisma and SQL', () => {
    for (const state of ['CREATING', 'READY', 'FAILED', 'UNKNOWN']) {
      expect(schema).toMatch(
        new RegExp(`enum BillingCheckoutAttemptState[\\s\\S]*\\b${state}\\b`),
      );
      expect(migration).toContain(`'${state}'`);
    }
  });

  it('defines reservation identity, lease, provider result and lifecycle fields', () => {
    const attempt = modelBody('BillingCheckoutAttempt');
    for (const field of [
      'id',
      'userId',
      'orderId',
      'generation',
      'state',
      'idempotencyKey',
      'leaseOwner',
      'leaseExpiresAt',
      'providerCheckoutId',
      'billingPaymentId',
      'lastErrorCode',
      'lastErrorMessage',
      'createdAt',
      'updatedAt',
      'completedAt',
    ]) {
      expect(attempt).toMatch(new RegExp(`\\b${field}\\b`));
    }
    expect(attempt).not.toMatch(/accessToken|jwt|card|payer/i);
  });

  it('uses restrictive relations without changing existing financial rows', () => {
    const attempt = modelBody('BillingCheckoutAttempt');
    expect(attempt).toContain(
      'User                         @relation(fields: [userId], references: [id], onDelete: Restrict)',
    );
    expect(attempt).toContain(
      'BillingOrder                 @relation(fields: [orderId], references: [id], onDelete: Restrict)',
    );
    expect(attempt).toContain(
      'BillingPayment?               @relation(fields: [billingPaymentId], references: [id], onDelete: Restrict)',
    );
    expect(migration).not.toMatch(
      /(?:^|\n)\s*(?:UPDATE|DELETE|TRUNCATE|INSERT)\b/im,
    );
    expect(migration).not.toMatch(/ALTER TABLE "BillingPayment"/);
    expect(migration).not.toMatch(/ALTER TABLE "BillingOrder"/);
  });

  it('supports historical generations and globally unique idempotency keys', () => {
    const attempt = modelBody('BillingCheckoutAttempt');
    expect(attempt).toContain('idempotencyKey     String');
    expect(attempt).toContain('@unique');
    expect(attempt).toContain('@@unique([orderId, generation])');
    expect(attempt).not.toContain('@@unique([orderId])');
    expect(migration).toContain(
      '"BillingCheckoutAttempt_orderId_generation_key"',
    );
    expect(migration).toContain('"BillingCheckoutAttempt_idempotencyKey_key"');
  });

  it('creates the required lookup indexes', () => {
    for (const index of [
      'BillingCheckoutAttempt_userId_state_idx',
      'BillingCheckoutAttempt_orderId_idx',
      'BillingCheckoutAttempt_leaseExpiresAt_idx',
      'BillingCheckoutAttempt_state_updatedAt_idx',
    ]) {
      expect(migration).toContain(`"${index}"`);
    }
  });

  it('documents the SQL-only partial unique index in Prisma schema', () => {
    expect(schema).toContain('BillingCheckoutAttempt_one_active_per_user_key');
    expect(schema).toContain('PARTIAL UNIQUE INDEX');
    expect(modelBody('BillingCheckoutAttempt')).not.toContain(
      '@@unique([userId])',
    );
  });

  it('does not drop the partial unique index in later migrations', () => {
    const dir = join(__dirname, '../../prisma/migrations');
    const later = readdirSync(dir).filter(
      (name) =>
        name > '20261103143000_billing_checkout_attempt' &&
        !name.startsWith('.'),
    );
    for (const name of later) {
      const sqlPath = join(dir, name, 'migration.sql');
      try {
        const sql = readFileSync(sqlPath, 'utf8');
        expect(sql).not.toMatch(
          /DROP\s+INDEX\s+"BillingCheckoutAttempt_one_active_per_user_key"/i,
        );
      } catch {
        continue;
      }
    }
  });

  it('allows only one CREATING or UNKNOWN attempt per user', () => {
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX "BillingCheckoutAttempt_one_active_per_user_key"[\s\S]*ON "BillingCheckoutAttempt"\("userId"\)[\s\S]*WHERE "state" IN \('CREATING', 'UNKNOWN'\);/,
    );
    const activeIndex = migration.match(
      /CREATE UNIQUE INDEX "BillingCheckoutAttempt_one_active_per_user_key"[\s\S]*?;/,
    )?.[0];
    expect(activeIndex).not.toContain('READY');
    expect(activeIndex).not.toContain('FAILED');
  });

  it('permits a later generation after READY or FAILED history', () => {
    expect(migration).toContain(`WHERE "state" IN ('CREATING', 'UNKNOWN')`);
    expect(migration).not.toMatch(
      /UNIQUE INDEX [^\n]*\nON "BillingCheckoutAttempt"\("orderId"\);/,
    );
    expect(migration).toContain(
      'CONSTRAINT "BillingCheckoutAttempt_generation_positive" CHECK ("generation" > 0)',
    );
  });
});
