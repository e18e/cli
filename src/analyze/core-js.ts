import {join} from 'node:path';
import {glob} from 'tinyglobby';
import {minVersion} from 'semver';
import type {AnalysisContext, ReportPluginResult} from '../types.js';

import coreJsCompat from 'core-js-compat';

const BROAD_IMPORTS = new Set([
  'core-js',
  'core-js/stable',
  'core-js/actual',
  'core-js/full'
]);

const SOURCE_GLOB = '**/*.{js,ts,mjs,cjs,jsx,tsx}';
const SOURCE_IGNORE = [
  'node_modules/**',
  'dist/**',
  'build/**',
  'coverage/**',
  'lib/**'
];

const IMPORT_RE =
  /(?:import\s+(?:.*\s+from\s+)?|require\s*\()\s*['"]([^'"]+)['"]/g;

export async function runCoreJsAnalysis(
  context: AnalysisContext
): Promise<ReportPluginResult> {
  const messages: ReportPluginResult['messages'] = [];
  const pkg = context.packageFile;

  const hasCoreJs =
    'core-js' in (pkg.dependencies ?? {}) ||
    'core-js' in (pkg.devDependencies ?? {}) ||
    'core-js-pure' in (pkg.dependencies ?? {}) ||
    'core-js-pure' in (pkg.devDependencies ?? {});

  if (!hasCoreJs) {
    return {messages};
  }

  const nodeRange = pkg.engines?.node;
  let targetVersion = 'current';
  if (nodeRange) {
    const floor = minVersion(nodeRange);
    if (floor) {
      targetVersion = floor.version;
    }
  }

  const {list: unnecessaryForTarget} = coreJsCompat.compat({
    targets: {node: targetVersion},
    inverse: true
  });
  const unnecessarySet = new Set(unnecessaryForTarget);

  const srcDirs = context.options?.src;
  let files: string[];
  if (srcDirs && srcDirs.length > 0) {
    const results = await Promise.all(
      srcDirs.map(async (dir) => {
        const matches = await glob(SOURCE_GLOB, {
          cwd: join(context.root, dir)
        });
        return matches.map((f) => join(dir, f));
      })
    );
    files = results.flat();
  } else {
    files = await glob(SOURCE_GLOB, {cwd: context.root, ignore: SOURCE_IGNORE});
  }

  for (const filePath of files) {
    let source: string;
    try {
      source = await context.fs.readFile(filePath);
    } catch {
      continue;
    }

    for (const [, specifier] of source.matchAll(IMPORT_RE)) {
      if (BROAD_IMPORTS.has(specifier)) {
        messages.push({
          severity: 'warning',
          score: 0,
          message: `Broad core-js import "${specifier}" in ${filePath} loads all polyfills at once. Import only the specific modules you need.`
        });
      } else if (specifier.startsWith('core-js/modules/')) {
        const moduleName = specifier.slice('core-js/modules/'.length);
        if (unnecessarySet.has(moduleName)) {
          messages.push({
            severity: 'suggestion',
            score: 0,
            message: `core-js polyfill "${moduleName}" imported in ${filePath} is unnecessary — your Node.js target (>= ${targetVersion}) already supports this natively.`
          });
        }
      }
    }
  }

  return {messages};
}
