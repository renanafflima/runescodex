import { assertRuntimeEnvironment, resolveAppEnv } from './database-target';

const devJwt = 'dev-only-not-for-production';
const stagingJwt = 'staging-secret-that-is-at-least-32-chars';
const prodJwt = 'production-secret-that-is-at-least-32';

describe('database environment guard', () => {
  it('keeps development on the local database', () => {
    const result = assertRuntimeEnvironment({
      APP_ENV: 'development',
      DATABASE_URL:
        'postgresql://runescodex:runescodex_dev@localhost:5432/runescodex_dev',
      JWT_SECRET: devJwt,
    });
    expect(result).toEqual({ appEnv: 'development', host: 'localhost' });
  });

  it('refuses a remote database while APP_ENV is development', () => {
    expect(() =>
      assertRuntimeEnvironment({
        APP_ENV: 'development',
        NODE_ENV: 'development',
        DATABASE_URL:
          'postgresql://user:super-secret@ep-prod.example.neon.tech/prod?sslmode=require',
        JWT_SECRET: devJwt,
      }),
    ).toThrow(/Development cannot use this database host/);
  });

  it('does not include the connection string in the refusal', () => {
    try {
      assertRuntimeEnvironment({
        APP_ENV: 'development',
        DATABASE_URL:
          'postgresql://user:super-secret@ep-prod.example.neon.tech/prod',
        JWT_SECRET: devJwt,
      });
      throw new Error('expected refusal');
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      expect(message).not.toContain('super-secret');
      expect(message).not.toContain('postgresql://');
    }
  });

  it('allows a separate development host only when it is named explicitly', () => {
    const result = assertRuntimeEnvironment({
      APP_ENV: 'development',
      DEV_DATABASE_HOST: 'ep-dev.example.neon.tech',
      DATABASE_URL: 'postgresql://user:dev-secret@ep-dev.example.neon.tech/dev',
      JWT_SECRET: devJwt,
    });
    expect(result.host).toBe('ep-dev.example.neon.tech');
  });

  it('refuses to point development at the production host even when named', () => {
    expect(() =>
      assertRuntimeEnvironment({
        APP_ENV: 'development',
        DEV_DATABASE_HOST: 'db.prod.internal',
        PRODUCTION_DATABASE_HOST: 'db.prod.internal',
        DATABASE_URL: 'postgresql://user:secret@db.prod.internal/prod',
        JWT_SECRET: devJwt,
      }),
    ).toThrow(/Development cannot use this database host/);
  });

  it('keeps staging on the staging host', () => {
    const result = assertRuntimeEnvironment({
      APP_ENV: 'staging',
      STAGING_DATABASE_HOST: 'db.staging.internal',
      PRODUCTION_DATABASE_HOST: 'db.prod.internal',
      DATABASE_URL:
        'postgresql://user:staging-secret@db.staging.internal/staging',
      JWT_SECRET: stagingJwt,
    });
    expect(result).toEqual({ appEnv: 'staging', host: 'db.staging.internal' });
  });

  it('refuses staging when the URL host is production', () => {
    expect(() =>
      assertRuntimeEnvironment({
        APP_ENV: 'staging',
        STAGING_DATABASE_HOST: 'db.prod.internal',
        PRODUCTION_DATABASE_HOST: 'db.prod.internal',
        DATABASE_URL: 'postgresql://user:secret@db.prod.internal/prod',
        JWT_SECRET: stagingJwt,
      }),
    ).toThrow(/cannot use the production database/);
  });

  it('keeps production on the production host', () => {
    const result = assertRuntimeEnvironment({
      NODE_ENV: 'production',
      PRODUCTION_DATABASE_HOST: 'db.prod.internal',
      STAGING_DATABASE_HOST: 'db.staging.internal',
      DATABASE_URL: 'postgresql://user:prod-secret@db.prod.internal/prod',
      JWT_SECRET: prodJwt,
    });
    expect(result).toEqual({ appEnv: 'production', host: 'db.prod.internal' });
  });

  it('refuses a local database in production', () => {
    expect(() =>
      assertRuntimeEnvironment({
        APP_ENV: 'production',
        DATABASE_URL:
          'postgresql://runescodex:runescodex_dev@localhost:5432/runescodex_dev',
        JWT_SECRET: prodJwt,
      }),
    ).toThrow(/Production cannot use the development or staging database/);
  });

  it('refuses to seed production', () => {
    expect(() =>
      assertRuntimeEnvironment(
        {
          APP_ENV: 'production',
          PRODUCTION_DATABASE_HOST: 'db.prod.internal',
          DATABASE_URL: 'postgresql://user:prod-secret@db.prod.internal/prod',
          JWT_SECRET: prodJwt,
        },
        { seed: true },
      ),
    ).toThrow(/Refusing to seed a production database/);
  });

  it('refuses a shared placeholder JWT outside development', () => {
    expect(() =>
      assertRuntimeEnvironment({
        APP_ENV: 'staging',
        STAGING_DATABASE_HOST: 'db.staging.internal',
        DATABASE_URL: 'postgresql://user:secret@db.staging.internal/staging',
        JWT_SECRET: devJwt,
      }),
    ).toThrow(/JWT_SECRET must be unique/);
  });

  it('maps NODE_ENV=production to production when APP_ENV is absent', () => {
    expect(resolveAppEnv({ NODE_ENV: 'production' })).toBe('production');
    expect(
      resolveAppEnv({ APP_ENV: 'development', NODE_ENV: 'production' }),
    ).toBe('development');
  });
});
