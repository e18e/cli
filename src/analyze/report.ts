import {detectAndPack} from '#detect-and-pack';
import {analyzePackageModuleType} from '../compute-type.js';
import {LocalFileSystem} from '../local-file-system.js';
import {TarballFileSystem} from '../tarball-file-system.js';
import type {FileSystem} from '../file-system.js';
import {Message, Options, ReportPlugin, Stat, Stats} from '../types.js';
import {runAttw} from './attw.js';
import {runPublint} from './publint.js';
import {runReplacements} from './replacements.js';
import {runKnip} from './knip.js';

export type ReportPlugin = (fileSystem: FileSystem) => Promise<Message[]>;

export interface ReportResult {
  info: {
    name: string;
    version: string;
    type: PackageModuleType;
  };
  messages: Message[];
  dependencies: DependencyStats;
}

const defaultPlugins: ReportPlugin[] = [runAttw, runPublint, runReplacements, runKnip];

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
  const {root = process.cwd(), pack = 'auto', features} = options ?? {};

  let fileSystem: FileSystem;
  const messages: Message[] = [];
  const extraStats: Stat[] = [];
  let stats: Stats = {
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
  const seenStatKeys = new Set<string>();

  const enabledFeatures = features ? features.split(',').map(f => f.trim()) : [];
  
  let plugins = defaultPlugins;
  
  if (enabledFeatures.length > 0) {
    // Only add plugins for explicitly enabled features
    const selectedPlugins: ReportPlugin[] = [];
    
    if (enabledFeatures.includes('types')) {
      selectedPlugins.push(runAttw);
    }
    if (enabledFeatures.includes('publish')) {
      selectedPlugins.push(runPublint);
    }
    if (enabledFeatures.includes('unused')) {
      selectedPlugins.push(runKnip);
    }
    // runReplacements is always included as it's a core analysis
    selectedPlugins.push(runReplacements);
    
    plugins = selectedPlugins;
  }

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
      stats = {
        ...stats,
        ...result.stats,
        extraStats
      };
      if (result.stats.extraStats) {
        for (const stat of result.stats.extraStats) {
          if (seenStatKeys.has(stat.name)) {
            continue;
          }
          seenStatKeys.add(stat.name);
          result.stats.extraStats.push(stat);
        }
      }
    }
  }

  const info = await computeInfo(fileSystem);

  return {info, messages, stats};
}
