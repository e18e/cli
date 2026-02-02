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

  // Recursively traverse dependencies
  async function traverse(packagePath: string, pathInTree: string) {
    const depPkg = await getPackageJson(context.fs, packagePath);
    if (!depPkg || !depPkg.name) return;

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
        await traverse(packageMatch, pathInTree + ' > ' + depName);
      }
    }
  }

  // Start traversal from root
  await traverse('/package.json', 'root');

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
