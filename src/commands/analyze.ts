import {type CommandContext} from 'gunshi';
import {promises as fsp, type Stats} from 'node:fs';
import * as prompts from '@clack/prompts';
import {styleText} from 'node:util';
import {meta} from './analyze.meta.js';
import {fixableReplacements} from './fixable-replacements.js';
import {report} from '../index.js';
import {enableDebug} from '../logger.js';

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

const BULLET_INDENT = 4; // "  • " = 4 visible chars before message
const CONTINUATION_INDENT = '    ';

function wrapMessage(
  text: string,
  bulletPrefix: string,
  width: number = process.stdout?.columns ?? 80
): string {
  const maxContentWidth = Math.max(20, width - BULLET_INDENT);
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxContentWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);

  return lines
    .map((line, i) =>
      i === 0 ? `${bulletPrefix}${line}` : `${CONTINUATION_INDENT}${line}`
    )
    .join('\n');
}

export async function run(ctx: CommandContext<typeof meta>) {
  const [_commandName, providedPath] = ctx.positionals;
  const logLevel = ctx.values['log-level'];
  let root: string | undefined = undefined;

  // Enable debug output based on log level
  if (logLevel === 'debug') {
    enableDebug('e18e:*');
  }

  prompts.intro('Analyzing...');

  // Path can be a directory (analyze project)
  if (providedPath) {
    let stat: Stats | null = null;
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
    manifest: customManifests,
    fixableByMigrate: fixableReplacements.map((r) => r.from)
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
        prompts.log.message(wrapMessage(msg.message, `  ${bullet} `), {
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
        prompts.log.message(wrapMessage(msg.message, `  ${bullet} `), {
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
        prompts.log.message(wrapMessage(msg.message, `  ${bullet} `), {
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
}
