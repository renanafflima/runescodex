import {
  assertPromoteAdminSafety,
  normalizeAdminEmail,
  promoteExistingUserToAdmin,
  type PromoteAdminDb,
} from './promote-admin';

describe('promoteExistingUserToAdmin', () => {
  const baseInput = {
    email: 'TechTechnologyTri@gmail.com',
    confirmTarget: 'local',
    confirmDatabaseHost: 'localhost',
    confirmDatabaseName: 'runescodex_dev',
    allowPromote: 'YES',
    databaseUrl: 'postgresql://runescodex:x@localhost:5432/runescodex_dev',
    appEnv: 'development',
  };

  function db(role: string | null): PromoteAdminDb & {
    users: Array<{ id: string; email: string; role: string }>;
    audits: Array<Record<string, unknown>>;
  } {
    const users =
      role === null
        ? []
        : [
            {
              id: 'user-1',
              email: 'techtechnologytri@gmail.com',
              role,
            },
          ];
    const audits: Array<Record<string, unknown>> = [];
    return {
      users,
      audits,
      user: {
        findUnique: async ({ where }) =>
          users.find((row) => row.email === where.email) ?? null,
        updateMany: async ({ where, data }) => {
          const row = users.find(
            (item) => item.id === where.id && item.role !== 'ADMIN',
          );
          if (!row) return { count: 0 };
          Object.assign(row, data);
          return { count: 1 };
        },
        findUniqueOrThrow: async ({ where }) => {
          const row = users.find((item) => item.id === where.id);
          if (!row) throw new Error('missing');
          return row;
        },
      },
      adminAuditEvent: {
        create: async ({ data }) => {
          audits.push(data);
          return data;
        },
      },
    };
  }

  it('normalizes the email and refuses unsafe confirmations', () => {
    expect(normalizeAdminEmail(' Tech@Example.COM ')).toBe('tech@example.com');
    expect(() =>
      assertPromoteAdminSafety({ ...baseInput, allowPromote: 'no' }),
    ).toThrow(/ALLOW_ADMIN_PROMOTE/);
    expect(() =>
      assertPromoteAdminSafety({
        ...baseInput,
        confirmDatabaseHost: 'db.prod.internal',
      }),
    ).toThrow(/CONFIRM_DATABASE_HOST/);
    expect(() =>
      assertPromoteAdminSafety({
        ...baseInput,
        confirmTarget: 'production',
        appEnv: 'production',
        confirmDatabaseHost: 'localhost',
        databaseUrl: 'postgresql://u:p@localhost:5432/runescodex_dev',
      }),
    ).toThrow(/cannot use a local database host/);
  });

  it('promotes an existing USER once and stays idempotent', async () => {
    const state = db('USER');
    const other = {
      id: 'user-2',
      email: 'other@example.com',
      role: 'USER',
    };
    state.users.push(other);

    const first = await promoteExistingUserToAdmin(state, baseInput);
    expect(first).toMatchObject({
      status: 'promoted',
      email: 'techtechnologytri@gmail.com',
      previousRole: 'USER',
      role: 'ADMIN',
      target: 'local',
    });
    expect(state.users[0]?.role).toBe('ADMIN');
    expect(other.role).toBe('USER');
    expect(state.audits).toEqual([
      expect.objectContaining({
        action: 'admin.role_promote',
        actorUserId: 'user-1',
      }),
    ]);

    const second = await promoteExistingUserToAdmin(state, baseInput);
    expect(second.status).toBe('already_admin');
    expect(state.audits).toHaveLength(1);
  });

  it('does not create a user when the email is missing', async () => {
    const state = db(null);
    await expect(promoteExistingUserToAdmin(state, baseInput)).resolves.toEqual(
      expect.objectContaining({
        status: 'not_found',
        email: 'techtechnologytri@gmail.com',
      }),
    );
    expect(state.users).toHaveLength(0);
    expect(state.audits).toHaveLength(0);
  });
});
