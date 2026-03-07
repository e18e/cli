import {createRequire} from 'node:module';
import {join, relative} from 'node:path';
import {glob} from 'tinyglobby';
import {minVersion} from 'semver';
import type {AnalysisContext, ReportPluginResult} from '../types.js';

const cjsRequire = createRequire(import.meta.url);
const {compat, modules: allModules} = cjsRequire('core-js-compat') as {
  compat: (opts: {targets: Record<string, string>; inverse?: boolean}) => {
    list: string[];
  };
  modules: string[];
};

const {list: modernUnnecessary} = compat({
  targets: 'last 2 versions',
  inverse: true
});
const MODERN_UNNECESSARY_COUNT = modernUnnecessary.length;

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

  const {list: unnecessaryForTarget} = compat({
    targets: {node: targetVersion},
    inverse: true
  });
  const unnecessarySet = new Set(unnecessaryForTarget);

  const files = await glob(SOURCE_GLOB, {
    cwd: context.root,
    ignore: SOURCE_IGNORE
  });

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

export async function runVendoredCoreJsAnalysis(
  context: AnalysisContext
): Promise<ReportPluginResult> {
  const messages: ReportPluginResult['messages'] = [];

  if (!context.options?.buildDir) {
    return {messages};
  }

  const buildDirAbs = join(context.root, context.options.buildDir);
  let buildFiles: string[];
  try {
    buildFiles = await glob('**/*.js', {cwd: buildDirAbs, absolute: true});
  } catch {
    return {messages};
  }

  const totalPolyfills = allModules.length;
  let totalVendoredBytes = 0;

  for (const filePath of buildFiles) {
    const rel = relative(context.root, filePath);
    let source: string;
    let size: number;
    try {
      [source, size] = await Promise.all([
        context.fs.readFile(rel),
        context.fs.getFileSize(rel)
      ]);
    } catch {
      continue;
    }

    // core-js embeds these strings as runtime literals in its version metadata, so they
    // typically survive minification — but aggressive dead-code elimination could remove them.
    if (!source.includes('Denis Pushkarev') && !source.includes('zloirock')) {
      continue;
    }

    totalVendoredBytes += size;

    const versionMatch = source.match(/version:"(\d+\.\d+\.\d+)"/);
    const version = versionMatch ? versionMatch[1] : 'unknown';
    const sizeKb = (size / 1024).toFixed(1);

    messages.push({
      severity: 'warning',
      score: 0,
      message: `Vendored core-js ${version} detected in ${rel} (${sizeKb} KB). core-js ships ${totalPolyfills} total polyfills, ${MODERN_UNNECESSARY_COUNT} of which are unnecessary for modern browsers. Consider using a targeted polyfill strategy or removing core-js from your build.`
    });
  }

  const stats: ReportPluginResult['stats'] =
    totalVendoredBytes > 0
      ? {
          extraStats: [
            {
              name: 'vendoredPolyfillSize',
              label: 'Vendored Polyfill Size',
              value: totalVendoredBytes
            }
          ]
        }
      : undefined;

  return {messages, stats};
}
