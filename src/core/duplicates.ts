/**
 * Duplicate dependency detection logic.
 *
 * This module provides pure functions for detecting duplicate dependencies
 * from lockfile data, without any formatting or presentation logic.
 */

import type {ParsedLockFile} from 'lockparse';

/**
 * A map of package names to their installed versions.
 */
export type VersionsMap = Map<string, Set<string>>;

/**
 * Information about a duplicate dependency.
 */
export interface DuplicateInfo {
  /** The package name */
  name: string;
  /** Set of versions installed for this package */
  versions: Set<string>;
  /** Number of versions installed */
  versionCount: number;
}

/**
 * Summary of duplicate dependencies.
 */
export interface DuplicateSummary {
  /** Total number of packages with duplicates */
  duplicateCount: number;
  /** List of duplicate packages */
  duplicates: DuplicateInfo[];
}

/**
 * Computes a map of package names to their installed versions from a lockfile.
 *
 * This extracts all unique package name + version combinations from the
 * parsed lockfile.
 *
 * @param lockFile - Parsed lockfile from lockparse
 * @returns Map of package names to sets of installed versions
 */
export function computeDependencyVersions(
  lockFile: ParsedLockFile
): VersionsMap {
  const result: VersionsMap = new Map();

  for (const pkg of lockFile.packages) {
    if (!pkg.name || !pkg.version) continue;
    addVersion(result, pkg.name, pkg.version);
  }

  return result;
}

/**
 * Adds a version to the versions map.
 *
 * @param map - The versions map to update
 * @param name - Package name
 * @param version - Version string
 */
function addVersion(map: VersionsMap, name: string, version: string): void {
  let set = map.get(name);
  if (!set) {
    set = new Set();
    map.set(name, set);
  }
  set.add(version);
}

/**
 * Detects duplicate dependencies from a versions map.
 *
 * A duplicate is defined as a package that has more versions installed
 * than the specified threshold.
 *
 * @param versionMap - Map of package names to installed versions
 * @param threshold - Minimum number of versions to consider a duplicate (default: 1)
 * @returns Array of duplicate dependency info
 */
export function detectDuplicates(
  versionMap: VersionsMap,
  threshold: number = 1
): DuplicateInfo[] {
  const duplicates: DuplicateInfo[] = [];

  for (const [name, versions] of versionMap) {
    if (versions.size > threshold) {
      duplicates.push({
        name,
        versions,
        versionCount: versions.size
      });
    }
  }

  // Sort by version count descending, then by name
  duplicates.sort((a, b) => {
    if (b.versionCount !== a.versionCount) {
      return b.versionCount - a.versionCount;
    }
    return a.name.localeCompare(b.name);
  });

  return duplicates;
}

/**
 * Computes a summary of duplicate dependencies from a lockfile.
 *
 * This is a convenience function that combines computeDependencyVersions
 * and detectDuplicates.
 *
 * @param lockFile - Parsed lockfile from lockparse
 * @param threshold - Minimum number of versions to consider a duplicate (default: 1)
 * @returns Summary of duplicate dependencies
 */
export function computeDuplicateSummary(
  lockFile: ParsedLockFile,
  threshold: number = 1
): DuplicateSummary {
  const versionMap = computeDependencyVersions(lockFile);
  const duplicates = detectDuplicates(versionMap, threshold);

  return {
    duplicateCount: duplicates.length,
    duplicates
  };
}

/**
 * Computes the diff between two version sets.
 *
 * This is useful for the GitHub Action to compare before/after states.
 *
 * @param prev - Previous versions map
 * @param curr - Current versions map
 * @returns Array of changes with package name, previous versions, and current versions
 */
export function diffDependencyVersions(
  prev: VersionsMap,
  curr: VersionsMap
): Array<{name: string; previous: Set<string>; current: Set<string>}> {
  const names = new Set<string>([...prev.keys(), ...curr.keys()]);
  const changes: Array<{
    name: string;
    previous: Set<string>;
    current: Set<string>;
  }> = [];

  for (const name of names) {
    const a = prev.get(name) || new Set<string>();
    const b = curr.get(name) || new Set<string>();
    if (!setsEqual(a, b)) {
      changes.push({name, previous: a, current: b});
    }
  }

  return changes;
}

/**
 * Checks if two sets are equal.
 */
function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) {
    if (!b.has(v)) return false;
  }
  return true;
}
