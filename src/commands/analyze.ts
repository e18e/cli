import {type CommandContext} from 'gunshi';
import {promises as fsp, type Stats} from 'node:fs';
import * as prompts from '@clack/prompts';
import {styleText} from 'node:util';
import {meta} from './analyze.meta.js';
import {report} from '../index.js';
import {enableDebug} from '../logger.js';
import {wrapAnsi} from 'fast-wrap-ansi';

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

const SEVERITY_RANK: Record<string, number> = {
  error: 3,
  warning: 2,
  suggestion: 1
};
const FAIL_THRESHOLD_RANK: Record<string, number> = {
  error: 3,
  warn: 2,
  info: 1,
  debug: 0
};

export async function run(ctx: CommandContext<typeof meta>) {
  // Gunshi passes subcommand name as first positional; path is optional second
  const providedPath =
    ctx.positionals.length > 1 ? ctx.positionals[1] : undefined;
  const logLevel = ctx.values['log-level'];
  let root: string | undefined = undefined;

  // Enable debug output based on log level
  if (logLevel === 'debug') {
    enableDebug('e18e:*');
  }

  prompts.intro('Analyzing...');

  // Path can be a directory (analyze project)
  if (providedPath) {
    let stat: Stats | null;
    try {
      stat = await fsp.stat(providedPath);
    } catch {
      stat = null;
    }

    if (!stat || !stat.isDirectory()) {
      prompts.cancel(`Path must be a directory: ${providedPath}`);
      process.exit(1);
    }

    root = providedPath;
  }

  // Then read the manifest
  const customManifests = ctx.values['manifest'];

  const {stats, messages} = await report({
    root,
    manifest: customManifests
  });

  prompts.log.info('Summary');

  const totalDeps =
    stats.dependencyCount.production + stats.dependencyCount.development;
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
    prompts.log.message(
      `${styleText('cyan', `${label}`)}${value.padStart(paddingSize)}`,
      {
        spacing: 0
      }
    );
  }

  prompts.log.info('Results:');
  prompts.log.message('', {spacing: 0});

  // Display tool analysis results
  if (messages.length > 0) {
    const width = process.stdout?.columns ?? 80;
    const maxContentWidth = Math.max(20, width - 4);

    const formatBulletMessage = (text: string, bullet: string) =>
      wrapAnsi(text, maxContentWidth)
        .split('\n')
        .map((line, i) => (i === 0 ? `  ${bullet} ${line}` : `    ${line}`))
        .join('\n');

    const errorMessages = messages.filter((m) => m.severity === 'error');
    const warningMessages = messages.filter((m) => m.severity === 'warning');
    const suggestionMessages = messages.filter(
      (m) => m.severity === 'suggestion'
    );

    // Display errors
    if (errorMessages.length > 0) {
      prompts.log.message(styleText('red', 'Errors:'), {spacing: 0});
      for (const msg of errorMessages) {
        const bullet = styleText('red', '•');
        prompts.log.message(formatBulletMessage(msg.message, bullet), {
          spacing: 0
        });
      }
      prompts.log.message('', {spacing: 0});
    }

    // Display warnings
    if (warningMessages.length > 0) {
      prompts.log.message(styleText('yellow', 'Warnings:'), {spacing: 0});
      for (const msg of warningMessages) {
        const bullet = styleText('yellow', '•');
        prompts.log.message(formatBulletMessage(msg.message, bullet), {
          spacing: 0
        });
      }
      prompts.log.message('', {spacing: 0});
    }

    // Display suggestions
    if (suggestionMessages.length > 0) {
      prompts.log.message(styleText('blue', 'Suggestions:'), {spacing: 0});
      for (const msg of suggestionMessages) {
        const bullet = styleText('blue', '•');
        prompts.log.message(formatBulletMessage(msg.message, bullet), {
          spacing: 0
        });
      }
      prompts.log.message('', {spacing: 0});
    }

    const errorCount = errorMessages.length;
    const warningCount = warningMessages.length;
    const suggestionCount = suggestionMessages.length;
    const fixableCount = messages.filter(
      (m) => m.fixableBy === 'migrate'
    ).length;
    const parts: string[] = [];
    if (errorCount > 0)
      parts.push(`${errorCount} error${errorCount === 1 ? '' : 's'}`);
    if (warningCount > 0)
      parts.push(`${warningCount} warning${warningCount === 1 ? '' : 's'}`);
    if (suggestionCount > 0)
      parts.push(
        `${suggestionCount} suggestion${suggestionCount === 1 ? '' : 's'}`
      );
    let summary = parts.join(', ');
    if (fixableCount > 0)
      summary += ` (${fixableCount} fixable by \`npx @e18e/cli migrate\`)`;
    prompts.log.message(styleText('dim', summary), {spacing: 0});
  }
  prompts.outro('Done!');

  // Exit with non-zero when messages meet the fail threshold (--log-level)
  const thresholdRank = FAIL_THRESHOLD_RANK[logLevel] ?? 0;
  const hasFailingMessages =
    thresholdRank > 0 &&
    messages.some((m) => SEVERITY_RANK[m.severity] >= thresholdRank);
  if (hasFailingMessages) {
    process.exit(1);
  }
}
