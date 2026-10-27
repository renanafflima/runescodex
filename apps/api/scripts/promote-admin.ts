/**
 * Controlled ADMIN promotion for an existing account.
 *
 * Never creates users, never prints secrets, never runs without explicit
 * confirmation of target environment + database host/name.
 *
 * Example (local PowerShell):
 *   $env:ALLOW_ADMIN_PROMOTE="YES"
 *   $env:CONFIRM_TARGET="local"
 *   $env:CONFIRM_DATABASE_HOST="localhost"
 *   $env:CONFIRM_DATABASE_NAME="runescodex_dev"
 *   $env:ADMIN_EMAIL="techtechnologytri@gmail.com"
 *   npm run promote:admin
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { promoteExistingUserToAdmin } from '../src/admin/promote-admin.js';

function required(name: string) {
  const value = process.env[name]?.trim() ?? '';
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function main() {
  const databaseUrl = required('DATABASE_URL');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  try {
    const result = await promoteExistingUserToAdmin(prisma, {
      email: required('ADMIN_EMAIL'),
      confirmTarget: required('CONFIRM_TARGET'),
      confirmDatabaseHost: required('CONFIRM_DATABASE_HOST'),
      confirmDatabaseName: required('CONFIRM_DATABASE_NAME'),
      allowPromote: required('ALLOW_ADMIN_PROMOTE'),
      databaseUrl,
      appEnv: required('APP_ENV'),
    });

    if (result.status === 'not_found') {
      console.error(
        JSON.stringify({
          ok: false,
          status: 'not_found',
          email: result.email,
          target: result.target,
          databaseHost: result.databaseHost,
          databaseName: result.databaseName,
          message:
            'User does not exist in the confirmed database. Register or sign in with that email first, then rerun. No account was created.',
        }),
      );
      process.exitCode = 2;
      return;
    }

    console.log(
      JSON.stringify({
        ok: true,
        status: result.status,
        userId: result.userId,
        email: result.email,
        previousRole: result.previousRole,
        role: result.role,
        target: result.target,
        databaseHost: result.databaseHost,
        databaseName: result.databaseName,
        nextStep:
          'Sign out and sign in again (or refresh /auth/me) so the UI picks up role=ADMIN. JWT does not embed role; AdminGuard reads the database.',
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      ok: false,
      message: error instanceof Error ? error.message : 'unknown error',
    }),
  );
  process.exitCode = 1;
});
