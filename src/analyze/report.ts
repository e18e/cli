import {join} from 'node:path';
import {analyzePackageModuleType} from '../compute-type.js';
import {LocalFileSystem} from '../local-file-system.js';
import type {FileSystem} from '../file-system.js';
import type {
  Options,
  ReportPlugin,
  ReportPhase,
  Stats,
  Message,
  AnalysisContext
} from '../types.js';
import {runPublint} from './publint.js';
import {runReplacements} from './replacements.js';
import {runDependencyAnalysis} from './dependencies.js';
import {runPlugin, runPlugins} from '../plugin-runner.js';
import {getPackageJson, detectLockfile} from '../utils/package-json.js';
import {parse as parseLockfile} from 'lockparse';
import {runDuplicateDependencyAnalysis} from './duplicate-dependencies.js';
import {runCoreJsAnalysis} from './core-js.js';
import {runWebFeaturesCodemodsAnalysis} from './web-features-codemods.js';

export const ANALYSIS_PLUGINS: Array<{
  id: string;
  title: string;
  run: ReportPlugin;
}> = [
  {
    id: 'publint',
    title: 'Checking package publishing',
    run: runPublint
  },
  {
    id: 'replacements',
    title: 'Checking dependency replacements',
    run: runReplacements
  },
  {
    id: 'dependencies',
    title: 'Analyzing dependencies',
    run: runDependencyAnalysis
  },
  {
    id: 'duplicate-dependencies',
    title: 'Checking duplicate dependencies',
    run: runDuplicateDependencyAnalysis
  },
  {
    id: 'core-js',
    title: 'Scanning core-js usage',
    run: runCoreJsAnalysis
  },
  {
    id: 'web-features',
    title: 'Scanning source files',
    run: runWebFeaturesCodemodsAnalysis
  }
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

async function buildAnalysisContext(
  options: Options
): Promise<AnalysisContext> {
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
    throw new Error(`Failed to read lockfile at ${lockfilePath}: ${err}`, {
      cause: err
    });
  }

  try {
    packageFileJSON = await fileSystem.readFile('package.json');
  } catch (err) {
    const packageFilePath = join(root, 'package.json');
    throw new Error(
      `Failed to read package.json at ${packageFilePath}: ${err}`,
      {cause: err}
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
      development: 0
    },
    extraStats: []
  };

  return {
    fs: fileSystem,
    root,
    packageFile,
    lockfile: parsedLock,
    stats,
    messages,
    options
  };
}

async function finalizeReport(context: AnalysisContext) {
  const info = await computeInfo(context.fs);

  return {info, messages: context.messages, stats: context.stats};
}

async function runPhasedReport(
  options: Options,
  phased: NonNullable<Options['phased']>
) {
  let context: AnalysisContext | undefined;
  const seenExtra = new Set<string>();

  const phases: ReportPhase[] = [
    {
      id: 'setup',
      title: 'Loading project files',
      run: async () => {
        context = await buildAnalysisContext(options);
        for (const stat of context.stats.extraStats ?? []) {
          seenExtra.add(stat.name);
        }
      }
    },
    ...ANALYSIS_PLUGINS.map(({id, title, run}) => ({
      id,
      title,
      run: async () => {
        if (!context) {
          throw new Error('Analysis context was not initialized.');
        }
        await runPlugin(context, run, seenExtra);
      }
    }))
  ];

  await phased(phases);

  if (!context) {
    throw new Error('Analysis context was not initialized.');
  }

  return finalizeReport(context);
}

export async function report(options: Options) {
  if (options.phased) {
    return runPhasedReport(options, options.phased);
  }

  const context = await buildAnalysisContext(options);
  await runPlugins(
    context,
    ANALYSIS_PLUGINS.map((plugin) => plugin.run)
  );
  return finalizeReport(context);
}
