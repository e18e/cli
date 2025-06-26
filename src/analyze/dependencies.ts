import {analyzePackageModuleType} from './compute-type.js';
import type {
  DependencyStats,
  DependencyAnalyzer,
  PackageJsonLike,
  DependencyNode,
  DuplicateDependency
} from './types.js';
import {FileSystem} from './file-system.js';

/**
 * This file contains dependency analysis functionality.
 */

// Re-export types
export type {DependencyStats, DependencyAnalyzer};

/**
 * Detects duplicate dependencies from a list of dependency nodes
 */
function detectDuplicates(dependencyNodes: DependencyNode[]): DuplicateDependency[] {
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
    versionCounts.set(
      node.version,
      (versionCounts.get(node.version) || 0) + 1
    );
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

// Keep the existing tarball analysis for backward compatibility
export async function analyzeDependencies(
  fileSystem: FileSystem
): Promise<DependencyStats> {
  const packageFiles = await fileSystem.listPackageFiles();
  const rootDir = await fileSystem.getRootDir();

  // Find root package.json
  let pkg: PackageJsonLike;
  try {
    pkg = JSON.parse(await fileSystem.readFile(rootDir + '/package.json'));
  } catch {
    throw new Error('No package.json found.');
  }

  const installSize = await fileSystem.getInstallSize();
  const directDependencies = Object.keys(pkg.dependencies || {}).length;
  const devDependencies = Object.keys(pkg.devDependencies || {}).length;

  let cjsDependencies = 0;
  let esmDependencies = 0;
  const dependencyNodes: DependencyNode[] = [];

  // Helper to parse a package.json file
  async function parsePackageJson(path: string): Promise<PackageJsonLike | null> {
    try {
      return JSON.parse(await fileSystem.readFile(path));
    } catch {
      return null;
    }
  }

  // Recursively traverse dependencies
  async function traverse(
    packagePath: string,
    parent: string | undefined,
    depth: number,
    pathInTree: string
  ) {
    const depPkg = await parsePackageJson(packagePath);
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

    // Traverse dependencies
    const allDeps = { ...depPkg.dependencies, ...depPkg.devDependencies };
    for (const depName of Object.keys(allDeps)) {
      // Find all package.json files for this dependency
      const depFiles = packageFiles.filter(f => {
        const fileName = f.split('/').pop();
        return fileName === 'package.json' && f.includes(`/node_modules/${depName}/`);
      });

      // Also check if there's a symlink or the dependency exists in a different location
      const allDepFiles = packageFiles.filter(f => {
        const fileName = f.split('/').pop();
        if (fileName !== 'package.json') return false;
        const pathParts = f.split('/');
        return pathParts.some(part => part === depName);
      });

      // Use the first one found for traversal (this will be the one closest to root)
      let depFile = depFiles.length > 0 ? depFiles[0] :
                    allDepFiles.length > 0 ? allDepFiles[0] : null;

      // Fallback: If still not found, search all package.json files for one whose contents have the matching name
      if (!depFile) {
        for (const f of packageFiles) {
          try {
            const depPkg = JSON.parse(await fileSystem.readFile(f));
            if (depPkg.name === depName) {
              depFile = f;
              break;
            }
          } catch {
            // Skip invalid package.json files
          }
        }
      }

      if (depFile) {
        await traverse(
          depFile,
          depPkg.name,
          depth + 1,
          pathInTree + ' > ' + depName
        );
      }
    }
  }

  // Start traversal from root
  await traverse(rootDir + '/package.json', undefined, 0, 'root');

  // Collect all dependency instances for duplicate detection
  // This ensures we find all versions, even those in nested node_modules
  for (const file of packageFiles) {
    if (file === rootDir + '/package.json') {
      continue;
    }

    try {
      const depPkg = JSON.parse(await fileSystem.readFile(file));
      if (!depPkg.name) continue;

      // Check if we already have this exact package in our dependency nodes
      const alreadyExists = dependencyNodes.some(node =>
        node.packagePath === file
      );

      if (!alreadyExists) {
        // Extract path information from the file path
        const pathParts = file.split('/node_modules/');
        if (pathParts.length > 1) {
          const depPath = pathParts[pathParts.length - 1].replace('/package.json', '');
          const parentMatch = pathParts[pathParts.length - 2]?.split('/').pop();

          dependencyNodes.push({
            name: depPkg.name,
            version: depPkg.version || 'unknown',
            path: depPath,
            parent: parentMatch || undefined,
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

  const result: DependencyStats = {
    totalDependencies: directDependencies + devDependencies,
    directDependencies,
    devDependencies,
    cjsDependencies,
    esmDependencies,
    installSize,
    packageName: pkg.name,
    version: pkg.version,
    duplicateCount: duplicateDependencies.length
  };

  if (duplicateDependencies.length > 0) {
    result.duplicateDependencies = duplicateDependencies;
  }

  return result;
}
