import {existsSync} from 'node:fs';
import {join} from 'node:path';
import type {FileSystem} from '../file-system.js';
import type {PackageJsonLike} from '../types.js';

export async function getPackageJson(
  fileSystem: FileSystem,
  path: string = '/package.json'
): Promise<PackageJsonLike | null> {
  let packageJsonText: string;

  try {
    packageJsonText = await fileSystem.readFile(path);
  } catch {
    // No package.json found
    return null;
  }

  try {
    return JSON.parse(packageJsonText);
  } catch {
    // Not parseable
    return null;
  }
}

export const supportedLockfiles = [
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  'bun.lock'
] as const;

export function detectLockfile(workspacePath: string): string | undefined {
  for (const c of supportedLockfiles) {
    if (existsSync(join(workspacePath, c))) return c;
  }
  return undefined;
}
