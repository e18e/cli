import {type CommandContext} from 'gunshi';
import {promises as fsp, type Stats} from 'node:fs';
import * as prompts from '@clack/prompts';
import c from 'picocolors';
import {meta} from './analyze.meta.js';
import {report} from '../index.js';
import type {PackType} from '../types.js';
import {enableDebug} from '../logger.js';
import {
  isPackageInstalled,
  promptToInstall,
  installPackage
} from '../utils/dependency-check.js';

function formatBytes(bytes: number) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export async function run(ctx: CommandContext<typeof meta.args>) {
  const [_commandName, providedPath] = ctx.positionals;
  let pack: PackType = ctx.values.pack;
  const logLevel = ctx.values['log-level'];
  let attwEnabled = ctx.values.attw;
  let root: string | undefined = undefined;

  // Enable debug output based on log level
  if (logLevel === 'debug') {
    enableDebug('e18e:*');
  }

  prompts.intro('Analyzing...');

  // Check for optional dependencies if features are enabled
  if (attwEnabled) {
    const attwPackage = '@arethetypeswrong/core';
    if (!isPackageInstalled(attwPackage)) {
      const shouldInstall = await promptToInstall(attwPackage);

      if (shouldInstall) {
        const installed = await installPackage(attwPackage);
        if (installed) {
          prompts.log.info('Restarting analysis with ATTW enabled...');
          // Continue with analysis now that ATTW is installed
        } else {
          prompts.log.warn(
            'Installation failed. Please install the package manually and run the command again.'
          );
          process.exit(1);
        }
      } else {
        prompts.log.warn(
          `ATTW analysis will be skipped because ${c.cyan(attwPackage)} is not installed.`
        );
        attwEnabled = false;
      }
    }
  }

  const allowedPackChoices: ReadonlyArray<string> = meta.args.pack.choices;
  if (typeof pack === 'string' && !allowedPackChoices.includes(pack)) {
    prompts.cancel(
      `Invalid '--pack' option. Allowed values are: ${allowedPackChoices.join(', ')}`
    );
    process.exit(1);
  }

  // Path can be a directory (analyze project) or a tarball file (analyze tarball)
  if (providedPath) {
    let stat: Stats | null = null;
    try {
      stat = await fsp.stat(providedPath);
    } catch {
      stat = null;
    }

    if (!stat || (!stat.isFile() && !stat.isDirectory())) {
      prompts.cancel(
        `Path must be a tarball file or a directory: ${providedPath}`
      );
      process.exit(1);
    }

    if (stat.isFile()) {
      const buffer = await fsp.readFile(providedPath);
      const tarball = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      ) as ArrayBuffer;
      pack = {tarball};
    } else {
      root = providedPath; // analyze this directory (respecting --pack)
    }
  }

  // Then analyze the tarball
  const rawCustomManifests = ctx.values['manifest'];

  // NOTE: Gunshi quirk - array arguments are sometimes returned as single strings
  // when only one value is provided, so we need to handle both cases
  const customManifests = Array.isArray(rawCustomManifests)
    ? rawCustomManifests
    : rawCustomManifests
      ? [rawCustomManifests]
      : [];

  const {stats, messages} = await report({
    root,
    pack,
    manifest: customManifests,
    attw: attwEnabled
  });

  prompts.log.info('Summary');

  const totalDeps =
    stats.dependencyCount.production + stats.dependencyCount.development;
  const totalDeepDeps = stats.dependencyCount.cjs + stats.dependencyCount.esm;
  const esmPercentage =
    totalDeepDeps > 0
      ? Math.floor((stats.dependencyCount.esm / totalDeepDeps) * 100)
      : 0;
  const summaryPairs: Array<[string, string]> = [
    ['Package Name', stats.name],
    ['Version', stats.version],
    [
      'Install Size',
      stats.installSize === undefined
        ? 'Unknown'
        : formatBytes(stats.installSize)
    ],
    [
      'Dependencies',
      `${totalDeps} (${stats.dependencyCount.production} production, ${stats.dependencyCount.development} development)`
    ],
    [
      'ES Modules',
      `${esmPercentage}% (${stats.dependencyCount.esm} ESM, ${stats.dependencyCount.cjs} CJS)`
    ]
  ];

  // Iterate again (unfortunately) to display the stats
  if (stats.extraStats) {
    for (const stat of stats.extraStats) {
      const statName = stat.label ?? stat.name;
      const statValueString = stat.value.toString();
      summaryPairs.push([statName, statValueString]);
    }
  }

  let longestStatName = 0;

  // Iterate once to find the longest stat name
  for (const [label] of summaryPairs) {
    if (label.length > longestStatName) {
      longestStatName = label.length;
    }
  }

  for (const [label, value] of summaryPairs) {
    const paddingSize = longestStatName - label.length + value.length + 2;
    prompts.log.message(`${c.cyan(`${label}`)}${value.padStart(paddingSize)}`, {
      spacing: 0
    });
  }

  prompts.log.info('Results:');
  prompts.log.message('', {spacing: 0});

  // Display tool analysis results
  if (messages.length > 0) {
    const errorMessages = messages.filter((m) => m.severity === 'error');
    const warningMessages = messages.filter((m) => m.severity === 'warning');
    const suggestionMessages = messages.filter(
      (m) => m.severity === 'suggestion'
    );

    // Display errors
    if (errorMessages.length > 0) {
      prompts.log.message(c.red('Errors:'), {spacing: 0});
      for (const msg of errorMessages) {
        prompts.log.message(`  ${c.red('•')} ${msg.message}`, {spacing: 0});
      }
      prompts.log.message('', {spacing: 0});
    }

    // Display warnings
    if (warningMessages.length > 0) {
      prompts.log.message(c.yellow('Warnings:'), {spacing: 0});
      for (const msg of warningMessages) {
        prompts.log.message(`  ${c.yellow('•')} ${msg.message}`, {spacing: 0});
      }
      prompts.log.message('', {spacing: 0});
    }

    // Display suggestions
    if (suggestionMessages.length > 0) {
      prompts.log.message(c.blue('Suggestions:'), {spacing: 0});
      for (const msg of suggestionMessages) {
        prompts.log.message(`  ${c.blue('•')} ${msg.message}`, {spacing: 0});
      }
      prompts.log.message('', {spacing: 0});
    }
  }
  prompts.outro('Done!');
}
