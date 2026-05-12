import browserslist from 'browserslist';
import type {PackageJsonLike} from '../types.js';
import type {
  ResolvedRuntimeTarget,
  RuntimePrimarySource,
  TargetRuntime
} from './runtime-target.js';

export interface ResolveRuntimeTargetInput {
  root: string;
  packageFile: PackageJsonLike;
  /** CLI override; wins over project Browserslist config. */
  browserslistQuery?: string;
  /** CLI explicit runtime; if omitted, inferred from resolution path. */
  runtime?: TargetRuntime;
}

function normalizeBrowserslistQueries(
  value: string | undefined
): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed === '') {
    return undefined;
  }
  return [trimmed];
}

function queriesFromProject(root: string): string[] | undefined {
  const loaded = browserslist.loadConfig({path: root});
  if (!loaded || loaded.length === 0) {
    return undefined;
  }
  return [...loaded];
}

function inferRuntime(
  explicit: TargetRuntime | undefined,
  hasBrowserslistQueries: boolean
): TargetRuntime {
  if (explicit !== undefined) {
    return explicit;
  }
  if (hasBrowserslistQueries) {
    return 'browser';
  }
  return 'nodejs';
}

/**
 * Resolves effective analysis targets with precedence:
 * CLI `--browserslist-query` > project Browserslist > `engines.node` > default.
 */
export function resolveRuntimeTarget(
  input: ResolveRuntimeTargetInput
): ResolvedRuntimeTarget {
  const {
    root,
    packageFile,
    browserslistQuery: cliQuery,
    runtime: runtimeCli
  } = input;

  const nodeRange = packageFile.engines?.node;

  let primarySource: RuntimePrimarySource = 'default';
  let browserslistQueries: string[] | undefined;

  const cliNormalized = normalizeBrowserslistQueries(cliQuery);
  if (cliNormalized) {
    primarySource = 'cli-browserslist';
    browserslistQueries = cliNormalized;
  } else {
    const fromProject = queriesFromProject(root);
    if (fromProject) {
      primarySource = 'project-browserslist';
      browserslistQueries = fromProject;
    } else if (nodeRange) {
      primarySource = 'engines-node';
    }
  }

  const runtime = inferRuntime(
    runtimeCli,
    browserslistQueries !== undefined && browserslistQueries.length > 0
  );

  return {
    runtime,
    primarySource,
    browserslistQueries,
    nodeRange
  };
}

/** One-line summary for CLI / `stats.extraStats` (Analyze target row). */
export function formatResolvedRuntimeTargetSummary(
  t: ResolvedRuntimeTarget
): string {
  const queries = t.browserslistQueries?.join(', ');
  switch (t.primarySource) {
    case 'cli-browserslist':
      return queries
        ? `${t.runtime} (CLI Browserslist: ${queries})`
        : `${t.runtime} (CLI Browserslist)`;
    case 'project-browserslist':
      return queries
        ? `${t.runtime} (Browserslist: ${queries})`
        : `${t.runtime} (Browserslist)`;
    case 'engines-node':
      return t.nodeRange
        ? `${t.runtime} (engines.node: ${t.nodeRange})`
        : `${t.runtime} (engines.node)`;
    default:
      return `${t.runtime} (default — no Browserslist or engines.node)`;
  }
}
