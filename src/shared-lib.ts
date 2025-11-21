import type {ParsedLockFile} from 'lockparse';
import {existsSync} from 'node:fs';
import {join} from 'node:path';

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

export type VersionsSet = Map<string, Set<string>>;

function addVersion(map: VersionsSet, name: string, version: string): void {
  let set = map.get(name);
  if (!set) {
    set = new Set();
    map.set(name, set);
  }
  set.add(version);
}

export function computeDependencyVersions(
  lockFile: ParsedLockFile
): VersionsSet {
  const result: VersionsSet = new Map();

  for (const pkg of lockFile.packages) {
    if (!pkg.name || !pkg.version) continue;
    addVersion(result, pkg.name, pkg.version);
  }

  return result;
}
