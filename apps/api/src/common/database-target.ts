export type AppEnv = 'development' | 'staging' | 'production';

const LOCAL_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'postgres',
  'host.docker.internal',
]);

const SHARED_JWT_PLACEHOLDERS = new Set([
  'replace-with-a-long-random-secret',
  'dev-only-not-for-production',
  'replace-with-a-staging-only-secret',
]);

export function resolveAppEnv(env: NodeJS.ProcessEnv): AppEnv {
  const raw = env.APP_ENV?.trim().toLowerCase();
  if (raw === 'development' || raw === 'staging' || raw === 'production') {
    return raw;
  }
  if (env.NODE_ENV === 'production') {
    return 'production';
  }
  return 'development';
}

export function databaseHost(connectionString: string): string {
  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error('DATABASE_URL is not a valid URL');
  }
  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new Error('DATABASE_URL must use the postgresql scheme');
  }
  if (!parsed.hostname) {
    throw new Error('DATABASE_URL is missing a host');
  }
  return parsed.hostname;
}

export function assertJwtSecret(appEnv: AppEnv, secret: string | undefined) {
  const value = secret?.trim() ?? '';
  if (!value) {
    throw new Error('JWT_SECRET is not set');
  }
  if (appEnv === 'development') {
    return;
  }
  if (value.length < 32 || SHARED_JWT_PLACEHOLDERS.has(value)) {
    throw new Error(
      `${appEnv} JWT_SECRET must be unique to that environment and at least 32 characters`,
    );
  }
}

export function assertDatabaseEnvironment(env: NodeJS.ProcessEnv) {
  const appEnv = resolveAppEnv(env);
  const connectionString = env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const host = databaseHost(connectionString);
  const devHost = env.DEV_DATABASE_HOST?.trim();
  const stagingHost = env.STAGING_DATABASE_HOST?.trim();
  const productionHost = env.PRODUCTION_DATABASE_HOST?.trim();

  if (appEnv === 'development') {
    const allowed = new Set(LOCAL_HOSTS);
    if (devHost) {
      allowed.add(devHost);
    }
    if (!allowed.has(host) || host === stagingHost || host === productionHost) {
      throw new Error(
        'Development cannot use this database host. Use the local Postgres service or set DEV_DATABASE_HOST to a database that is not staging or production.',
      );
    }
  }

  if (appEnv === 'staging') {
    if (!stagingHost || host !== stagingHost || host === productionHost) {
      throw new Error(
        'Staging must use STAGING_DATABASE_HOST and cannot use the production database.',
      );
    }
  }

  if (appEnv === 'production') {
    if (LOCAL_HOSTS.has(host) || host === devHost || host === stagingHost) {
      throw new Error(
        'Production cannot use the development or staging database.',
      );
    }
    if (productionHost && host !== productionHost) {
      throw new Error(
        'Production DATABASE_URL host must match PRODUCTION_DATABASE_HOST.',
      );
    }
  }

  return { appEnv, host };
}

export function assertRuntimeEnvironment(
  env: NodeJS.ProcessEnv,
  options?: { seed?: boolean },
) {
  const target = assertDatabaseEnvironment(env);
  assertJwtSecret(target.appEnv, env.JWT_SECRET);
  if (options?.seed && target.appEnv === 'production') {
    throw new Error('Refusing to seed a production database.');
  }
  return target;
}
