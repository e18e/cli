import colors from 'picocolors';
import {analyzePackageModuleType} from '../compute-type.js';
import type {
  PackageJsonLike,
  ReportPluginResult,
  Message,
  Stats,
  AnalysisContext
} from '../types.js';
import type {FileSystem} from '../file-system.js';
import {normalizePath} from '../utils/path.js';
import {ParsedLockFile, traverse, VisitorFn} from 'lockparse';

interface DependencyNode {
  name: string;
  version: string;
  // TODO (43081j): make this an array or something structured one day
  path: string; // Path in dependency tree (e.g., "root > package-a > package-b")
  parent?: string; // Parent package name
  depth: number; // Depth in dependency tree
  packagePath: string; // File system path to package.json
}

interface DuplicateDependency {
  name: string;
  versions: DependencyNode[];
  severity: 'exact' | 'conflict' | 'resolvable';
  potentialSavings?: number;
  suggestions?: string[];
}

/**
 * Detects duplicate dependencies from a list of dependency nodes
 */
function detectDuplicates(
  dependencyNodes: DependencyNode[]
): DuplicateDependency[] {
  const duplicates: DuplicateDependency[] = [];
  const packageGroups = new Map<string, DependencyNode[]>();

  // Group dependencies by name
  for (const node of dependencyNodes) {
    if (!packageGroups.has(node.name)) {
      packageGroups.set(node.name, []);
    }
    packageGroups.get(node.name)?.push(node);
  }

  // Find packages with multiple versions
  for (const [packageName, nodes] of packageGroups) {
    if (nodes.length > 1) {
      const duplicate = analyzeDuplicate(packageName, nodes);
      if (duplicate) {
        duplicates.push(duplicate);
      }
    }
  }

  return duplicates;
}

/**
 * Analyzes a group of nodes for the same package to determine duplicate type
 */
function analyzeDuplicate(
  packageName: string,
  nodes: DependencyNode[]
): DuplicateDependency | null {
  // Skip root package
  if (packageName === 'root' || nodes.some((n) => n.name === 'root')) {
    return null;
  }

  const uniqueVersions = new Set(nodes.map((n) => n.version));

  let severity: 'exact' | 'conflict' | 'resolvable';

  // If more than one version, it's a conflict
  if (uniqueVersions.size === 1) {
    severity = 'exact';
  } else {
    severity = 'conflict';
  }

  return {
    name: packageName,
    versions: nodes,
    severity,
    potentialSavings: calculatePotentialSavings(nodes),
    suggestions: generateSuggestions(nodes)
  };
}

/**
 * Calculates potential savings from deduplication
 */
function calculatePotentialSavings(nodes: DependencyNode[]): number {
  // For now, return a simple estimate based on number of duplicates
  // TODO: Implement actual size calculation
  return nodes.length - 1;
}

/**
 * Generates suggestions for resolving duplicates
 */
function generateSuggestions(nodes: DependencyNode[]): string[] {
  const suggestions: string[] = [];

  // Group by version to identify the most common version
  const versionCounts = new Map<string, number>();
  for (const node of nodes) {
    versionCounts.set(node.version, (versionCounts.get(node.version) || 0) + 1);
  }

  const mostCommonVersion = Array.from(versionCounts.entries()).sort(
    (a, b) => b[1] - a[1]
  )[0];

  if (mostCommonVersion && mostCommonVersion[1] > 1) {
    suggestions.push(
      `Consider standardizing on version ${mostCommonVersion[0]} (used by ${mostCommonVersion[1]} dependencies)`
    );
  }

  // Suggest checking for newer versions of consuming packages
  const uniqueParents = new Set(nodes.map((n) => n.parent).filter(Boolean));
  if (uniqueParents.size > 1) {
    suggestions.push(
      `Check if newer versions of consuming packages (${Array.from(uniqueParents).join(', ')}) would resolve this duplicate`
    );
  }

  return suggestions;
}

/**
 * Attempts to parse a `package.json` file
 */
async function parsePackageJson(
  fileSystem: FileSystem,
  path: string
): Promise<PackageJsonLike | null> {
  try {
    return JSON.parse(await fileSystem.readFile(path));
  } catch {
    return null;
  }
}

// Keep the existing tarball analysis for backward compatibility
export async function runDependencyAnalysis(
  context: AnalysisContext
): Promise<ReportPluginResult> {
  const packageFiles = await context.fs.listPackageFiles();
  const rootDir = await context.fs.getRootDir();
  const messages: Message[] = [];

  // Find root package.json
  const pkg = await parsePackageJson(context.fs, '/package.json');

  if (!pkg) {
    throw new Error('No package.json found.');
  }

  const installSize = await context.fs.getInstallSize();
  const prodDependencies = Object.keys(pkg.dependencies || {}).length;
  const devDependencies = Object.keys(pkg.devDependencies || {}).length;
  const stats: Stats = {
    name: pkg.name,
    version: pkg.version,
    installSize,
    dependencyCount: {
      production: prodDependencies,
      development: devDependencies,
      esm: 0,
      cjs: 0,
      duplicate: 0
    }
  };

  let cjsDependencies = 0;
  let esmDependencies = 0;
  const dependencyNodes: DependencyNode[] = [];

  // Recursively traverse dependencies
  async function traverse(
    packagePath: string,
    parent: string | undefined,
    depth: number,
    pathInTree: string
  ) {
    const depPkg = await parsePackageJson(context.fs, packagePath);
    if (!depPkg || !depPkg.name) return;

    // Record this node
    dependencyNodes.push({
      name: depPkg.name,
      version: depPkg.version || 'unknown',
      path: pathInTree,
      parent,
      depth,
      packagePath
    });

    // Only count CJS/ESM for non-root packages
    if (depth > 0) {
      const type = analyzePackageModuleType(depPkg);
      if (type === 'cjs') cjsDependencies++;
      if (type === 'esm') esmDependencies++;
      if (type === 'dual') {
        cjsDependencies++;
        esmDependencies++;
      }
    }

    for (const depName of Object.keys(depPkg.dependencies || {})) {
      let packageMatch = packageFiles.find((packageFile) =>
        normalizePath(packageFile).endsWith(
          `/node_modules/${depName}/package.json`
        )
      );

      if (!packageMatch) {
        for (const packageFile of packageFiles) {
          const depPkg = await parsePackageJson(context.fs, packageFile);
          if (depPkg !== null && depPkg.name === depName) {
            packageMatch = packageFile;
            break;
          }
        }
      }

      if (packageMatch) {
        await traverse(
          packageMatch,
          depPkg.name,
          depth + 1,
          pathInTree + ' > ' + depName
        );
      }
    }
  }

  // Start traversal from root
  await traverse('/package.json', undefined, 0, 'root');

  // Collect all dependency instances for duplicate detection
  // This ensures we find all versions, even those in nested node_modules
  // TODO (43081j): don't do this. we're re-traversing most files just to
  // find the ones that don't exist in the parent package's dependency list.
  // there must be a better way
  for (const file of packageFiles) {
    const rootPackageJsonPath = normalizePath(rootDir) + '/package.json';
    if (file === rootPackageJsonPath) {
      continue;
    }

    try {
      const depPkg = await parsePackageJson(context.fs, file);
      if (!depPkg || !depPkg.name) {
        continue;
      }

      // Check if we already have this exact package in our dependency nodes
      const alreadyExists = dependencyNodes.some(
        (node) => node.packagePath === file
      );

      if (!alreadyExists) {
        // Extract path information from the file path
        const normalizedFile = normalizePath(file);
        const pathParts = normalizedFile.split('/node_modules/');
        if (pathParts.length > 1) {
          const packageDirName = pathParts[pathParts.length - 1].replace(
            '/package.json',
            ''
          );
          const parentDirName = pathParts[pathParts.length - 2]
            ?.split('/')
            .pop();

          dependencyNodes.push({
            name: depPkg.name,
            version: depPkg.version || 'unknown',
            path: packageDirName,
            parent: parentDirName,
            depth: pathParts.length - 1,
            packagePath: file
          });
        }
      }
    } catch {
      // Skip invalid package.json files
    }
  }

  // Detect duplicates from the collected dependency nodes
  const duplicateDependencies = detectDuplicates(dependencyNodes);

  stats.dependencyCount.cjs = cjsDependencies;
  stats.dependencyCount.esm = esmDependencies;

  if (duplicateDependencies.length > 0) {
    stats.dependencyCount.duplicate = duplicateDependencies.length;

    for (const duplicate of duplicateDependencies) {
      const severityColor =
        duplicate.severity === 'exact' ? colors.blue : colors.yellow;

      let message = `${severityColor('[duplicate dependency]')} ${colors.bold(duplicate.name)} has ${duplicate.versions.length} installed versions:`;

      for (const version of duplicate.versions) {
        message += `\n ${colors.gray(version.version)} via ${colors.gray(version.path)}`;
      }

      if (duplicate.suggestions && duplicate.suggestions.length > 0) {
        message += '\nSuggestions:';
        for (const suggestion of duplicate.suggestions) {
          message += `    ${colors.blue('💡')} ${colors.gray(suggestion)}`;
        }
      }

      messages.push({
        message,
        severity: 'warning',
        score: 0
      });
    }
  }

  return {stats, messages};
}

type ResolvedDependency = {
  name: string;
  version: string;
  //key: string; // lockfile identity
  parents: string[];
};

async function getInitialStats(context: AnalysisContext): Promise<Stats> {
  const lockfile = context.lockfile;

  if (!lockfile) {
    throw new Error('No package-lock.json found.');
  }

  const installSize = await context.fs.getInstallSize();
  const root = lockfile.root;
  const stats: Stats = {
    name: root.name,
    version: root.version,
    installSize,
    dependencyCount: {
      production: root.dependencies.length,
      development: root.devDependencies.length,
      esm: 0,
      cjs: 0,
      duplicate: 0
    }
  };
  return stats;
}

function exportOutput(
  stats: Stats,
  duplicateDependencies: Map<string, ResolvedDependency[]>,
  cjsDependencies: number,
  esmDependencies: number
) {
  const messages: Message[] = [];
  stats.dependencyCount.cjs = cjsDependencies;
  stats.dependencyCount.esm = esmDependencies;

  if (duplicateDependencies.size > 0) {
    stats.dependencyCount.duplicate = duplicateDependencies.size;

    for (const duplicate of duplicateDependencies.values()) {
      const severityColor = colors.green;

      let message = `${severityColor('[duplicate dependency]')} ${colors.bold(duplicate[0].name)} has ${duplicate.length} installed versions:`;

      for (const version of duplicate) {
        for (const parent of version.parents) {
          message += `\n ${colors.gray(version.version)} via ${colors.gray(parent)}`;
        }
      }
      message += '\n';

      // if (duplicate.suggestions && duplicate.suggestions.length > 0) {
      //   message += '\nSuggestions:';
      //   for (const suggestion of duplicate.suggestions) {
      //     message += `    ${colors.blue('💡')} ${colors.gray(suggestion)}`;
      //   }
      // }

      messages.push({
        message,
        severity: 'warning',
        score: 0
      });
    }
  }

  return {stats, messages};
}

function resolveDependencies(
  lockfile: ParsedLockFile
): Map<string, ResolvedDependency[]> {
  const resolvedDependencies: Map<string, ResolvedDependency[]> = new Map();
  for (const pkg of lockfile.packages) {
    const entry: ResolvedDependency = {
      name: pkg.name,
      version: pkg.version,
      parents: []
    };
    if (!resolvedDependencies.has(pkg.name)) {
      resolvedDependencies.set(pkg.name, [entry]);
    } else {
      const packageEntries = resolvedDependencies.get(pkg.name);
      if (!packageEntries?.some((x) => x.version === pkg.version)) {
        packageEntries?.push(entry);
      }
    }
  }
  return resolvedDependencies;
}

async function computeParents(
  lockfile: ParsedLockFile,
  duplicateDependencies: Map<string, ResolvedDependency[]>
) {
  const visitorFn: VisitorFn = (node, parent, path) => {
    if (!duplicateDependencies.has(node.name) || !path) {
      return;
    }
    const resolvedDependencies = duplicateDependencies.get(node.name);
    if (!resolvedDependencies) {
      return;
    }

    //get the correct version
    const version = resolvedDependencies.find(
      (x) => x.version === node.version
    );
    if (!version) {
      return;
    }
    if (!parent) {
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

export async function runDependencyAnalysisNEW(
  context: AnalysisContext
): Promise<ReportPluginResult> {
  const lockfile = context.lockfile;

  if (!lockfile) {
    throw new Error('No package-lock.json found.');
  }

  const stats: Stats = await getInitialStats(context);

  const resolvedDependencies = resolveDependencies(lockfile);
  const duplicateDependencies: Map<string, ResolvedDependency[]> = new Map();
  for (const [packageName, dependencies] of resolvedDependencies) {
    if (dependencies.length <= 1) {
      continue;
    }
    duplicateDependencies.set(packageName, dependencies);
  }

  await computeParents(lockfile, duplicateDependencies);

  return exportOutput(stats, duplicateDependencies, 0, 0);
}
