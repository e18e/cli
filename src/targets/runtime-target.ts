/**
 * Runtime dimension for replacement engine matching.
 */
export const TARGET_RUNTIMES = [
  'any',
  'browser',
  'nodejs',
  'deno',
  'bun',
  'cloudflare'
] as const;

export type TargetRuntime = (typeof TARGET_RUNTIMES)[number];

const RUNTIME_SET = new Set<string>(TARGET_RUNTIMES);

export type RuntimePrimarySource =
  | 'cli-browserslist'
  | 'project-browserslist'
  | 'engines-node'
  | 'default';

export interface ResolvedRuntimeTarget {
  /** Effective runtime for `engines_match_runtime`-style checks. */
  runtime: TargetRuntime;
  /** Highest-precedence source that supplied browserlist-style targets. */
  primarySource: RuntimePrimarySource;
  /** Queries passed to tools that accept Browserslist (e.g. core-js-compat). */
  browserslistQueries: string[] | undefined;
  /** `package.json#engines.node` when present (always from manifest). */
  nodeRange: string | undefined;
}

export function parseTargetRuntime(
  value: string | undefined
): TargetRuntime | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }
  const trimmed = value.trim();
  if (!RUNTIME_SET.has(trimmed)) {
    throw new Error(
      `Invalid --runtime "${value}". Valid values: ${TARGET_RUNTIMES.join(', ')}`
    );
  }
  return trimmed as TargetRuntime;
}
