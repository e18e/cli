/**
 * Trust level computation for npm packages based on provenance attestations.
 *
 * This module provides pure functions for computing trust levels without
 * making network calls. The actual package metadata must be fetched separately.
 */

/**
 * The provenance status of a package, indicating its level of trust.
 *
 * - `trusted-with-provenance`: Published by a trusted publisher with provenance attestations
 * - `provenance`: Has provenance attestations but not from a trusted publisher
 * - `none`: No provenance attestations
 */
export type ProvenanceStatus =
  | 'trusted-with-provenance'
  | 'provenance'
  | 'none';

/**
 * Result of computing the minimum trust level across a set of packages.
 */
export interface MinTrustLevelResult {
  level: number;
  status: ProvenanceStatus;
}

/**
 * Summary of trust levels across a set of dependencies.
 */
export interface TrustSummary {
  trusted: number;
  provenance: number;
  untrusted: number;
  total: number;
}

/**
 * Determines the provenance status of a package from its metadata.
 *
 * @param meta - Package metadata from the npm registry (must have `dist?.attestations?.provenance` and/or `_npmUser?.trustedPublisher`)
 * @returns The provenance status of the package
 */
export function getProvenance(meta: {
  dist?: { attestations?: { provenance?: unknown } };
  _npmUser?: { trustedPublisher?: unknown };
}): ProvenanceStatus {
  if (meta._npmUser?.trustedPublisher) {
    return 'trusted-with-provenance';
  }
  if (meta.dist?.attestations?.provenance) {
    return 'provenance';
  }
  return 'none';
}

/**
 * Converts a provenance status to a numeric trust level.
 *
 * Higher numbers indicate higher trust:
 * - 2: trusted-with-provenance
 * - 1: provenance
 * - 0: none
 *
 * @param status - The provenance status
 * @returns The numeric trust level (0-2)
 */
export function getTrustLevel(status: ProvenanceStatus): number {
  switch (status) {
    case 'trusted-with-provenance':
      return 2;
    case 'provenance':
      return 1;
    case 'none':
      return 0;
    default:
      return 0;
  }
}

/**
 * Finds the minimum trust level across a set of provenance statuses.
 *
 * This is useful for determining the overall trust level of a dependency tree,
 * where the weakest link determines the overall security.
 *
 * @param statuses - An iterable of provenance statuses
 * @returns The minimum trust level and its corresponding status
 */
export function getMinTrustLevel(
  statuses: Iterable<ProvenanceStatus>
): MinTrustLevelResult {
  let result: MinTrustLevelResult | null = null;

  for (const status of statuses) {
    const level = getTrustLevel(status);
    if (result === null || level < result.level) {
      result = {level, status};
    }
  }

  if (!result) {
    return {level: 0, status: 'none'};
  }

  return result;
}

/**
 * Computes a summary of trust levels from a collection of provenance statuses.
 *
 * @param statuses - An iterable of provenance statuses
 * @returns A summary with counts for each trust category
 */
export function computeTrustSummary(
  statuses: Iterable<ProvenanceStatus>
): TrustSummary {
  let trusted = 0;
  let provenance = 0;
  let untrusted = 0;

  for (const status of statuses) {
    switch (status) {
      case 'trusted-with-provenance':
        trusted++;
        break;
      case 'provenance':
        provenance++;
        break;
      case 'none':
        untrusted++;
        break;
    }
  }

  return {
    trusted,
    provenance,
    untrusted,
    total: trusted + provenance + untrusted
  };
}
