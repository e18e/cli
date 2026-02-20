import type {
  ReportPluginResult,
  Message,
  Stats,
  AnalysisContext,
  PackageJsonLike
} from '../types.js';
import {normalizePath} from '../utils/path.js';
import {getPackageJson} from '../utils/package-json.js';

export async function runDependencyAnalysis(
  context: AnalysisContext
): Promise<ReportPluginResult> {
  const packageFiles = await context.fs.listPackageFiles();

  const messages: Message[] = [];
  const pkg = context.packageFile;

  if (!pkg) {
    throw new Error('No package.json found.');
  }

  const installSize = await context.fs.getInstallSize();
  const prodDependencies = Object.keys(pkg.dependencies || {}).length;
  const devDependencies = Object.keys(pkg.devDependencies || {}).length;

  const packageFilesByName = new Map<string, string>();
  for (const file of packageFiles) {
    const normalized = normalizePath(file);
    const match = normalized.match(
      /\/node_modules\/((?:@[^/]+\/)?[^/]+)\/package\.json$/
    );
    if (match) {
      packageFilesByName.set(match[1], file);
    }
  }

  const pkgCache = new Map<string, PackageJsonLike | null>();

  async function getCachedPackageJson(pkgPath: string) {
    if (pkgCache.has(pkgPath)) {
      return pkgCache.get(pkgPath);
    }
    const result = await getPackageJson(context.fs, pkgPath);
    pkgCache.set(pkgPath, result);
    return result;
  }

  const visited = new Set<string>();

  async function traverse(packagePath: string) {
    if (visited.has(packagePath)) return;
    visited.add(packagePath);

    const depPkg = await getCachedPackageJson(packagePath);
    if (!depPkg || !depPkg.name) return;

    for (const depName of Object.keys(depPkg.dependencies || {})) {
      const packageMatch = packageFilesByName.get(depName);

      if (packageMatch) {
        await traverse(packageMatch);
      }
    }
  }

  await traverse('/package.json');

  const stats: Partial<Stats> = {
    name: pkg.name,
    version: pkg.version,
    installSize,
    dependencyCount: {
      production: prodDependencies,
      development: devDependencies
    }
  };

  return {stats, messages};
}
