import {detectAndPack} from '#detect-and-pack';
import {analyzePackageModuleType} from '../compute-type.js';
import {LocalFileSystem} from '../local-file-system.js';
import {TarballFileSystem} from '../tarball-file-system.js';
import type {FileSystem} from '../file-system.js';
import type {Options, ReportPlugin, Stat, Stats} from '../types.js';
import {runAttw} from './attw.js';
import {runPublint} from './publint.js';
import {runReplacements} from './replacements.js';
import {runDependencyAnalysis} from './dependencies.js';
import {runPlugins} from '../plugin-runner.js';

const plugins: ReportPlugin[] = [
  runAttw,
  runPublint,
  runReplacements,
  runDependencyAnalysis
];

async function computeInfo(fileSystem: FileSystem) {
  try {
    const pkgJson = await fileSystem.readFile('/package.json');
    const pkg = JSON.parse(pkgJson);
    return {
      name: pkg.name,
      version: pkg.version,
      type: analyzePackageModuleType(pkg)
    };
  } catch {
    throw new Error('No package.json found.');
  }
}

export async function report(options: Options) {
  const {root = process.cwd(), pack = 'auto'} = options ?? {};

  let fileSystem: FileSystem;

  const extraStats: Stat[] = [];
  const baseStats: Stats = {
    name: 'unknown',
    version: 'unknown',
    dependencyCount: {
      production: 0,
      development: 0,
      cjs: 0,
      duplicate: 0,
      esm: 0
    },
    extraStats
  };

  if (pack === 'none') {
    fileSystem = new LocalFileSystem(root);
  } else {
    let tarball: ArrayBuffer;

    if (typeof pack === 'object') {
      tarball = pack.tarball;
    } else {
      tarball = await detectAndPack(root, pack);
    }

    fileSystem = new TarballFileSystem(tarball);
  }

  const {messages, stats: aggregated} = await runPlugins(
    fileSystem,
    plugins,
    options,
    baseStats
  );

  const info = await computeInfo(fileSystem);

  return {info, messages, stats: aggregated};
}
