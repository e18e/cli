import colors from 'picocolors';
import {analyzePackageModuleType} from '../compute-type.js';
import type {
  PackageJsonLike,
  ReportPluginResult,
  Message,
  Stats
} from '../types.js';
import type {FileSystem} from '../file-system.js';
import {normalizePath} from '../utils/path.js';

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
  fileSystem: FileSystem
): Promise<ReportPluginResult> {
  const packageFiles = await fileSystem.listPackageFiles();
  const rootDir = await fileSystem.getRootDir();
  const messages: Message[] = [];

  const rootDirNorm = normalizePath(rootDir);
  const virtualToRaw = new Map<string, string>();
  const packageFilesVirtual = new Set<string>();
  for (const raw of packageFiles) {
    const rawNorm = normalizePath(raw);
    let virtual = rawNorm;
    if (virtual.startsWith(rootDirNorm + '/')) {
      virtual = virtual.slice(rootDirNorm.length + 1);
    }
    if (virtual.startsWith('/')) {
      virtual = virtual.slice(1);
    }
    packageFilesVirtual.add(virtual);
    virtualToRaw.set(virtual, rawNorm);
  }

  // Find root package.json
  const pkg = await parsePackageJson(fileSystem, '/package.json');

  if (!pkg) {
    throw new Error('No package.json found.');
  }

  const installSize = await fileSystem.getInstallSize();
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
    packagePathRaw: string,
    packagePathVirtual: string,
    parent: string | undefined,
    depth: number,
    pathInTree: string
  ) {
    const depPkg = await parsePackageJson(fileSystem, packagePathRaw);
    if (!depPkg || !depPkg.name) return;

    // Record this node
    dependencyNodes.push({
      name: depPkg.name,
      version: depPkg.version || 'unknown',
      path: pathInTree,
      parent,
      depth,
      packagePath: packagePathRaw
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

    // Traverse dependencies
    const allDeps = {
      ...(depPkg.dependencies || {}),
      ...(depPkg.devDependencies || {})
    };

    const visited = new Set<string>();

    function dirOfVirtual(p: string): string {
      if (p.endsWith('/package.json'))
        return p.slice(0, -'/package.json'.length);
      if (p === 'package.json') return '';
      const idx = p.lastIndexOf('/');
      return idx === -1 ? '' : p.slice(0, idx);
    }

    function parentDirVirtual(dir: string): string {
      const idx = dir.lastIndexOf('/');
      return idx === -1 ? '' : dir.slice(0, idx);
    }

    function resolveDepVirtual(
      depName: string,
      fromVirtual: string
    ): string | undefined {
      let cur = dirOfVirtual(fromVirtual);
      while (true) {
        const prefix = cur ? cur + '/' : '';
        const candidate = `${prefix}node_modules/${depName}/package.json`;
        if (packageFilesVirtual.has(candidate)) return candidate;
        if (cur === '') break;
        cur = parentDirVirtual(cur);
      }
      return undefined;
    }

    for (const depName of Object.keys(allDeps)) {
      const resolvedVirtual = resolveDepVirtual(depName, packagePathVirtual);
      if (!resolvedVirtual) continue;
      if (visited.has(resolvedVirtual)) continue;
      visited.add(resolvedVirtual);

      const raw = virtualToRaw.get(resolvedVirtual) ?? resolvedVirtual;
      await traverse(
        raw,
        resolvedVirtual,
        depPkg.name,
        depth + 1,
        pathInTree + ' > ' + depName
      );
    }
  }

  // Start traversal from root using '/package.json' and a normalized virtual 'package.json'
  await traverse('/package.json', 'package.json', undefined, 0, 'root');

  // Detect duplicates from collected nodes
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
