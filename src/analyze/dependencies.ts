import {analyzePackageModuleType} from '../compute-type.js';
import type {
  ReportPluginResult,
  Message,
  Stats,
  AnalysisContext
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

  let cjsDependencies = 0;
  let esmDependencies = 0;

  // Recursively traverse dependencies
  async function traverse(
    packagePath: string,
    depth: number,
    pathInTree: string
  ) {
    const depPkg = await getPackageJson(context.fs, packagePath);
    if (!depPkg || !depPkg.name) return;

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
          const depPkg = await getPackageJson(context.fs, packageFile);
          if (depPkg !== null && depPkg.name === depName) {
            packageMatch = packageFile;
            break;
          }
        }
      }

      if (packageMatch) {
        await traverse(packageMatch, depth + 1, pathInTree + ' > ' + depName);
      }
    }
  }

  // Start traversal from root
  await traverse('/package.json', 0, 'root');

  const stats: Partial<Stats> = {
    name: pkg.name,
    version: pkg.version,
    installSize,
    dependencyCount: {
      production: prodDependencies,
      development: devDependencies,
      esm: esmDependencies,
      cjs: cjsDependencies
    }
  };

  return {stats, messages};
}
