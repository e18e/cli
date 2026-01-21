import {join} from 'node:path';
import {analyzePackageModuleType} from '../compute-type.js';
import {LocalFileSystem} from '../local-file-system.js';
import type {FileSystem} from '../file-system.js';
import type {
  Options,
  ReportPlugin,
  Stats,
  Message,
  AnalysisContext
} from '../types.js';
import {runPublint} from './publint.js';
import {runReplacements} from './replacements.js';
import {runDependencyAnalysis} from './dependencies.js';
import {runPlugins} from '../plugin-runner.js';
import {getPackageJson, detectLockfile} from '../utils/package-json.js';
import {parse as parseLockfile} from 'lockparse';
import {runDuplicateDependencyAnalysis} from './duplicate-dependencies.js';

const plugins: ReportPlugin[] = [
  runPublint,
  runReplacements,
  runDependencyAnalysis,
  runDuplicateDependencyAnalysis
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
  const {root = process.cwd()} = options ?? {};

  const messages: Message[] = [];

  const fileSystem = new LocalFileSystem(root);
  const lockfileFilename = detectLockfile(root);

  if (!lockfileFilename) {
    // TODO (jg): error nicely?
    throw new Error('No lockfile found in the project root.');
  }

  let lockfile: string;
  let packageFileJSON: string;

  try {
    lockfile = await fileSystem.readFile(lockfileFilename);
  } catch (err) {
    const lockfilePath = join(root, lockfileFilename);
    throw new Error(`Failed to read lockfile at ${lockfilePath}: ${err}`);
  }

  try {
    packageFileJSON = await fileSystem.readFile('package.json');
  } catch (err) {
    const packageFilePath = join(root, 'package.json');
    throw new Error(
      `Failed to read package.json at ${packageFilePath}: ${err}`
    );
  }

  const packageFile = JSON.parse(packageFileJSON);
  const parsedLock = await parseLockfile(
    lockfile,
    lockfileFilename,
    packageFile ?? undefined
  );

  const stats: Stats = {
    name: packageFile.name || 'unknown',
    version: packageFile.version || '0.0.0',
    dependencyCount: {
      production: 0,
      development: 0,
      cjs: 0,
      esm: 0
    },
    extraStats: []
  };

  const context: AnalysisContext = {
    fs: fileSystem,
    root,
    packageFile,
    lockfile: parsedLock,
    stats,
    messages,
    options
  };
  await runPlugins(context, plugins);

  const info = await computeInfo(fileSystem);

  return {info, messages, stats};
}
