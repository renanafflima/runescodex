import { databaseHost } from '../common/database-target';

export type PromoteTarget = 'local' | 'staging' | 'production';

export type PromoteAdminInput = {
  email: string;
  confirmTarget: string;
  confirmDatabaseHost: string;
  confirmDatabaseName: string;
  allowPromote: string;
  databaseUrl: string;
  appEnv: string;
};

export type PromoteAdminResult =
  | {
      status: 'promoted' | 'already_admin';
      userId: string;
      email: string;
      previousRole: string;
      role: 'ADMIN';
      target: PromoteTarget;
      databaseHost: string;
      databaseName: string;
    }
  | {
      status: 'not_found';
      email: string;
      target: PromoteTarget;
      databaseHost: string;
      databaseName: string;
    };

const TARGETS: PromoteTarget[] = ['local', 'staging', 'production'];

export function normalizeAdminEmail(email: string) {
  return email.trim().toLowerCase();
}

export function parseDatabaseName(connectionString: string) {
  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error('DATABASE_URL is not a valid URL');
  }
  const name = decodeURIComponent(parsed.pathname.replace(/^\//, '')).trim();
  if (!name) {
    throw new Error('DATABASE_URL is missing a database name');
  }
  return name;
}

export function assertPromoteAdminSafety(input: PromoteAdminInput) {
  if (input.allowPromote !== 'YES') {
    throw new Error(
      'Refusing to promote. Set ALLOW_ADMIN_PROMOTE=YES to confirm this controlled operation.',
    );
  }

  const target = input.confirmTarget.trim().toLowerCase() as PromoteTarget;
  if (!TARGETS.includes(target)) {
    throw new Error(
      'CONFIRM_TARGET must be exactly local, staging, or production.',
    );
  }

  const expectedAppEnv =
    target === 'local' ? 'development' : target;
  if (input.appEnv.trim().toLowerCase() !== expectedAppEnv) {
    throw new Error(
      `APP_ENV must be ${expectedAppEnv} when CONFIRM_TARGET=${target}.`,
    );
  }

  const host = databaseHost(input.databaseUrl);
  const databaseName = parseDatabaseName(input.databaseUrl);
  const confirmHost = input.confirmDatabaseHost.trim().toLowerCase();
  const confirmName = input.confirmDatabaseName.trim();

  if (!confirmHost || confirmHost !== host.toLowerCase()) {
    throw new Error(
      'CONFIRM_DATABASE_HOST does not match the DATABASE_URL host. Promotion aborted.',
    );
  }
  if (!confirmName || confirmName !== databaseName) {
    throw new Error(
      'CONFIRM_DATABASE_NAME does not match the DATABASE_URL database. Promotion aborted.',
    );
  }

  if (target === 'local') {
    const localHosts = new Set([
      'localhost',
      '127.0.0.1',
      '::1',
      'postgres',
      'host.docker.internal',
    ]);
    if (!localHosts.has(host.toLowerCase())) {
      throw new Error(
        'CONFIRM_TARGET=local only allows a local database host.',
      );
    }
  }

  if (target === 'production' && localish(host)) {
    throw new Error(
      'CONFIRM_TARGET=production cannot use a local database host.',
    );
  }

  const email = normalizeAdminEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('ADMIN_EMAIL is not a valid email address.');
  }

  return { target, host, databaseName, email };
}

function localish(host: string) {
  return new Set([
    'localhost',
    '127.0.0.1',
    '::1',
    'postgres',
    'host.docker.internal',
  ]).has(host.toLowerCase());
}

export type PromoteAdminDb = {
  user: {
    findUnique: (args: {
      where: { email: string };
      select: { id: true; email: true; role: true };
    }) => Promise<{ id: string; email: string; role: string } | null>;
    updateMany: (args: {
      where: { id: string; role: { not: 'ADMIN' } };
      data: { role: 'ADMIN' };
    }) => Promise<{ count: number }>;
    findUniqueOrThrow: (args: {
      where: { id: string };
      select: { id: true; email: true; role: true };
    }) => Promise<{ id: string; email: string; role: string }>;
  };
  adminAuditEvent: {
    create: (args: {
      data: {
        actorUserId: string;
        action: string;
        entityType: string;
        entityId: string;
        summary: string;
        metadata?: Record<string, string>;
      };
    }) => Promise<unknown>;
  };
};

/**
 * Promotes an existing account to ADMIN. Never creates users or changes passwords.
 * Idempotent: already-ADMIN returns already_admin without rewriting history noise.
 */
export async function promoteExistingUserToAdmin(
  db: PromoteAdminDb,
  input: PromoteAdminInput,
): Promise<PromoteAdminResult> {
  const safety = assertPromoteAdminSafety(input);
  const user = await db.user.findUnique({
    where: { email: safety.email },
    select: { id: true, email: true, role: true },
  });

  if (!user) {
    return {
      status: 'not_found',
      email: safety.email,
      target: safety.target,
      databaseHost: safety.host,
      databaseName: safety.databaseName,
    };
  }

  if (user.role === 'ADMIN') {
    return {
      status: 'already_admin',
      userId: user.id,
      email: user.email,
      previousRole: 'ADMIN',
      role: 'ADMIN',
      target: safety.target,
      databaseHost: safety.host,
      databaseName: safety.databaseName,
    };
  }

  const previousRole = user.role;
  const updated = await db.user.updateMany({
    where: { id: user.id, role: { not: 'ADMIN' } },
    data: { role: 'ADMIN' },
  });
  if (updated.count !== 1) {
    const current = await db.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { id: true, email: true, role: true },
    });
    if (current.role === 'ADMIN') {
      return {
        status: 'already_admin',
        userId: current.id,
        email: current.email,
        previousRole: 'ADMIN',
        role: 'ADMIN',
        target: safety.target,
        databaseHost: safety.host,
        databaseName: safety.databaseName,
      };
    }
    throw new Error('Failed to promote user; role was not updated.');
  }

  await db.adminAuditEvent.create({
    data: {
      actorUserId: user.id,
      action: 'admin.role_promote',
      entityType: 'user',
      entityId: user.id,
      summary: 'Promoção controlada para ADMIN',
      metadata: {
        previousRole,
        target: safety.target,
        emailDomain: safety.email.split('@')[1] ?? '',
      },
    },
  });

  return {
    status: 'promoted',
    userId: user.id,
    email: user.email,
    previousRole,
    role: 'ADMIN',
    target: safety.target,
    databaseHost: safety.host,
    databaseName: safety.databaseName,
  };
}
