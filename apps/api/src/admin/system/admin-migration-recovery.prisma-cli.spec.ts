import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFile } from 'node:child_process';

jest.mock('node:child_process', () => ({
  execFile: jest.fn(),
}));

import {
  assertPrismaApiRoot,
  assertPrismaCli,
  execPrismaCli,
} from './admin-migration-recovery.prisma-cli';

const execFileMock = execFile as unknown as jest.Mock;

describe('admin-migration-recovery.prisma-cli', () => {
  beforeEach(() => {
    execFileMock.mockImplementation(
      (
        _file: string,
        _args: string[],
        _opts: object,
        cb: (err: null, stdout: string, stderr: string) => void,
      ) => {
        cb(null, '', '');
      },
    );
  });

  it('resolves apps/api when prisma.config.ts is present', () => {
    const root = assertPrismaApiRoot(process.cwd());
    expect(existsSync(join(root, 'prisma.config.ts'))).toBe(true);
  });

  it('resolves the local Prisma CLI entrypoint', () => {
    const cli = assertPrismaCli();
    expect(cli.endsWith(join('prisma', 'build', 'index.js'))).toBe(true);
    expect(existsSync(cli)).toBe(true);
  });

  it('invokes node + prisma build index for migrate status', async () => {
    execFileMock.mockClear();
    await execPrismaCli(['migrate', 'status']);
    expect(execFileMock).not.toHaveBeenCalledWith('npx', expect.anything(), expect.anything());
    const [node, args, opts] = execFileMock.mock.calls[0];
    expect(node).toBe(process.execPath);
    expect(args[0]).toMatch(/prisma[/\\]build[/\\]index\.js$/);
    expect(args.slice(1)).toEqual(['migrate', 'status']);
    expect(existsSync(join(opts.cwd, 'prisma.config.ts'))).toBe(true);
  });
});
