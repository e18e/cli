import {detectAndPack} from '#detect-and-pack';
import {analyzePackageModuleType} from '../compute-type.js';
import {LocalFileSystem} from '../local-file-system.js';
import {TarballFileSystem} from '../tarball-file-system.js';
import type {FileSystem} from '../file-system.js';
import type {Options, ReportPlugin, Stat, Stats, Message} from '../types.js';
import {runPublint} from './publint.js';
import {runReplacements} from './replacements.js';
import {runDependencyAnalysis} from './dependencies.js';
import {runPlugins} from '../plugin-runner.js';
import {getPackageJson} from '../utils/package-json.js';

const plugins: ReportPlugin[] = [
  runPublint,
  runReplacements,
  runDependencyAnalysis
];

async function computeInfo(fileSystem: FileSystem) {
  const pkg = await getPackageJson(fileSystem);
  if (!pkg) {
    throw new Error('No package.json found.');
  }

  return {
    name: pkg.name || 'unknown',
    version: pkg.version || 'unknown',
    type: analyzePackageModuleType(pkg)
  };
}

export async function report(options: Options) {
  const {root = process.cwd(), pack = 'auto'} = options ?? {};

  let fileSystem: FileSystem;

  const extraStats: Stat[] = [];
  const stats: Stats = {
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
  const messages: Message[] = [];

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

  await runPlugins(fileSystem, plugins, stats, messages, options);

  const info = await computeInfo(fileSystem);

  return {info, messages, stats};
}
