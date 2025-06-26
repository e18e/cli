import {detectAndPack} from '#detect-and-pack';
import {analyzePackageModuleType, PackageModuleType} from '../compute-type.js';
import {analyzeDependencies, type DependencyStats} from './dependencies.js';
import {LocalFileSystem} from '../local-file-system.js';
import {TarballFileSystem} from '../tarball-file-system.js';
import type {FileSystem} from '../file-system.js';
import {Message, Options} from '../types.js';
import {runAttw} from './attw.js';
import {runPublint} from './publint.js';

export type ReportPlugin = (tarball: ArrayBuffer) => Promise<Message[]>;

export interface ReportResult {
  info: {
    name: string;
    version: string;
    type: PackageModuleType;
  };
  messages: Message[];
  dependencies: DependencyStats;
}

const plugins: ReportPlugin[] = [runAttw, runPublint];

async function computeInfo(fileSystem: FileSystem) {
  const rootDir = await fileSystem.getRootDir();

  try {
    const pkgJson = await fileSystem.readFile(rootDir + '/package.json');
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

    for (const plugin of plugins) {
      const result = await plugin(tarball);

      for (const message of result) {
        messages.push(message);
      }
    }
  }

  const info = await computeInfo(fileSystem);
  const dependencies = await analyzeDependencies(fileSystem);

  return {info, messages, dependencies};
}
