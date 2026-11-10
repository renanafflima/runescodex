import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** API package root: directory that contains prisma.config.ts (expected: apps/api). */
export function assertPrismaApiRoot(cwd = process.cwd()): string {
  const configPath = join(cwd, 'prisma.config.ts');
  if (!existsSync(configPath)) {
    throw new Error(
      `prisma.config.ts not found in ${cwd}. Run from the apps/api package root.`,
    );
  }
  return cwd;
}

export function assertPrismaCli(cwd = assertPrismaApiRoot()): string {
  const cli = join(cwd, 'node_modules', 'prisma', 'build', 'index.js');
  if (!existsSync(cli)) {
    throw new Error(
      `Prisma CLI not found at ${cli}. Install dependencies with npm install in apps/api.`,
    );
  }
  return cli;
}

export async function execPrismaCli(
  args: string[],
  options?: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    timeout?: number;
    maxBuffer?: number;
  },
): Promise<void> {
  const cwd = options?.cwd ?? assertPrismaApiRoot();
  const cli = assertPrismaCli(cwd);
  await execFileAsync(process.execPath, [cli, ...args], {
    cwd,
    env: options?.env ?? process.env,
    timeout: options?.timeout ?? 120_000,
    maxBuffer: options?.maxBuffer ?? 2 * 1024 * 1024,
  });
}
