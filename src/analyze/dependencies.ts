import type {
  ReportPluginResult,
  Message,
  Stats,
  AnalysisContext
} from '../types.js';

export async function runDependencyAnalysis(
  context: AnalysisContext
): Promise<ReportPluginResult> {
  const messages: Message[] = [];
  const pkg = context.packageFile;

  if (!pkg) {
    throw new Error('No package.json found.');
  }

  const installSize = await context.fs.getInstallSize();
  const prodDependencies = Object.keys(pkg.dependencies || {}).length;
  const devDependencies = Object.keys(pkg.devDependencies || {}).length;

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
