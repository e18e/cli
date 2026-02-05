import {styleText} from 'node:util';
import {ParsedLockFile, traverse, VisitorFn} from 'lockparse';
import {AnalysisContext, Message, ReportPluginResult, Stats} from '../types.js';

interface Version {
  version: string;
  parents: string[];
}

/**
 * Outputs packages with duplicate versions and suggest possible fixes
 * @param context
 */
export async function runDuplicateDependencyAnalysis(
  context: AnalysisContext
): Promise<ReportPluginResult> {
  const lockfile = context.lockfile;

  if (!lockfile) {
    throw new Error('No lock file found.');
  }

  const duplicateDependencies = resolveDuplicateDependencies(lockfile);
  await computeParents(lockfile, duplicateDependencies);
  return exportOutput(duplicateDependencies);
}

/**
 * Computes a map of package names to their unique versions using the lock file
 * It returns just the packages with multiple versions
 * @param lockfile
 */
function resolveDuplicateDependencies(
  lockfile: ParsedLockFile
): Map<string, Version[]> {
  const resolvedDependencies: Map<string, Version[]> = new Map();
  for (const pkg of lockfile.packages) {
    const entry: Version = {
      version: pkg.version,
      parents: []
    };
    if (!resolvedDependencies.has(pkg.name)) {
      resolvedDependencies.set(pkg.name, [entry]);
    } else {
      const packageEntries = resolvedDependencies.get(pkg.name);
      if (
        packageEntries &&
        !packageEntries.some((x) => x.version === pkg.version)
      ) {
        packageEntries.push(entry);
      }
    }
  }

  // find all the packages that have more than one version
  const duplicateDependencies: Map<string, Version[]> = new Map();
  for (const [packageName, versions] of resolvedDependencies) {
    if (versions.length <= 1) {
      continue;
    }
    duplicateDependencies.set(packageName, versions);
  }
  return duplicateDependencies;
}

/**
 * Compute all the parent packages that use each duplicate dependency
 * @param lockfile
 * @param duplicateDependencies
 */
async function computeParents(
  lockfile: ParsedLockFile,
  duplicateDependencies: Map<string, Version[]>
) {
  const visitorFn: VisitorFn = (node, parent, _path) => {
    if (!duplicateDependencies.has(node.name) || !parent) {
      return;
    }
    const resolvedVersions = duplicateDependencies.get(node.name);
    if (!resolvedVersions) {
      return;
    }

    // get the correct version
    const version = resolvedVersions.find((x) => x.version === node.version);
    if (!version) {
      return;
    }

    const parentPath = `${parent.name}@${parent.version}`;
    if (version.parents.includes(parentPath)) {
      return;
    }

    version.parents.push(parentPath);
  };
  const visitor = {
    dependency: visitorFn,
    devDependency: visitorFn,
    optionalDependency: visitorFn
  };

  traverse(lockfile.root, visitor);
}

function exportOutput(duplicateDependencies: Map<string, Version[]>) {
  const messages: Message[] = [];
  const stats: Partial<Stats> = {
    extraStats: [
      {
        name: 'duplicateDependencyCount',
        value: duplicateDependencies.size,
        label: 'Duplicate Dependency Count'
      }
    ]
  };
  if (duplicateDependencies.size === 0) {
    return {stats, messages};
  }

  for (const [packageName, duplicate] of duplicateDependencies) {
    let message = `${styleText('green', '[duplicate dependency]')} ${styleText('bold', packageName)} has ${duplicate.length} installed versions:`;

    for (const version of duplicate) {
      message += `\n${styleText('yellow', version.version)} via the following ${version.parents.length} package(s) ${styleText('blue', version.parents.join(', '))}`;
    }

    const suggestions = generateSuggestionsForDuplicate(duplicate);

    if (suggestions.length > 0) {
      message += '\n💡 Suggestions';
      for (const suggestion of suggestions) {
        message += `${styleText('gray', suggestion)}`;
      }
    }
    message += '\n';
    messages.push({
      message,
      severity: 'warning',
      score: 0
    });
  }

  return {stats, messages};
}

/**
 * Generates suggestions for resolving duplicates
 */
function generateSuggestionsForDuplicate(
  resolvedVersions: Version[]
): string[] {
  const suggestions: string[] = [];

  // Find the package version with the most parents
  const mostCommonVersion = resolvedVersions.sort(
    (a, b) => b.parents.length - a.parents.length
  )[0];

  if (mostCommonVersion?.parents.length > 1) {
    suggestions.push(
      `\n- Consider standardizing on version ${mostCommonVersion.version} as this version is the most commonly used.`
    );
  }

  // Suggest checking for newer versions of consuming packages
  suggestions.push(
    `\n- Consider upgrading consuming packages as this may resolve this duplicate version.`
  );

  return suggestions;
}
