import {detectAndPack} from '#detect-and-pack';
import {analyzePackageModuleType} from '../compute-type.js';
import {LocalFileSystem} from '../local-file-system.js';
import {TarballFileSystem} from '../tarball-file-system.js';
import type {FileSystem} from '../file-system.js';
import {Message, Options, ReportPlugin, Stat} from '../types.js';
import {runAttw} from './attw.js';
import {runPublint} from './publint.js';
import {runReplacements} from './replacements.js';
import {runDependencyAnalysis} from './dependencies.js';

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
  const messages: Message[] = [];
  const stats: Stat[] = [];
  const seenStatKeys = new Set<string>();

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

  for (const plugin of plugins) {
    const result = await plugin(fileSystem);

    for (const message of result.messages) {
      messages.push(message);
    }

    if (result.stats) {
      for (const stat of result.stats) {
        if (seenStatKeys.has(stat.name)) {
          continue;
        }
        seenStatKeys.add(stat.name);
        stats.push(stat);
      }
    }
  }

  const info = await computeInfo(fileSystem);

  return {info, messages, stats};
}
