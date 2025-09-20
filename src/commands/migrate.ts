import {type CommandContext} from 'gunshi';
import * as prompts from '@clack/prompts';
import colors from 'picocolors';
import {meta} from './migrate.meta.js';
import {glob} from 'tinyglobby';
import {readFile, writeFile} from 'node:fs/promises';
import {fixableReplacements} from './fixable-replacements.js';
import type {Replacement} from '../types.js';
import {LocalFileSystem} from '../local-file-system.js';
import {getPackageJson} from '../utils/package-json.js';

export async function run(ctx: CommandContext<typeof meta.args>) {
  const [_commandName, ...targetModules] = ctx.positionals;
  const dryRun = ctx.values['dry-run'] === true;
  const interactive = ctx.values.interactive === true;
  const include = ctx.values.include;
  const fileSystem = new LocalFileSystem(process.cwd());
  const packageJson = await getPackageJson(fileSystem);

  prompts.intro(`Migrating packages...`);

  if (!packageJson) {
    prompts.cancel(
      'Error: No package.json found in the current directory. Please run this command in a project directory.'
    );
    return;
  }

  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };

  const fixableReplacementsTargets = new Set(
    fixableReplacements
      .filter((rep) => Object.hasOwn(dependencies, rep.from))
      .map((rep) => rep.from)
  );

  if (interactive) {
    const additionalTargets = await prompts.autocompleteMultiselect({
      message: 'Select packages to migrate',
      maxItems: 10,
      options: [...fixableReplacementsTargets].map((target) => ({
        value: target,
        label: target
      })),
      initialValues: targetModules
    });

    if (prompts.isCancel(additionalTargets)) {
      prompts.cancel('Migration cancelled.');
      return;
    }

    for (const targetModule of additionalTargets) {
      if (!targetModules.includes(targetModule)) {
        targetModules.push(targetModule);
      }
    }
  }

  if (targetModules.length === 0) {
    prompts.cancel(
      'Error: Please specify a package to migrate. For example, `migrate chalk`'
    );
    return;
  }

  const selectedReplacements: Replacement[] = [];

  for (const targetModule of targetModules) {
    const replacement = fixableReplacements.find(
      (rep) => rep.from === targetModule
    );
    if (!replacement) {
      prompts.cancel(
        `Error: Target package has no available migrations (${targetModule})`
      );
      return;
    }

    selectedReplacements.push(replacement);
  }

  if (!interactive) {
    const targetModuleSummary =
      targetModules.length > 6
        ? `${targetModules.slice(0, 6).join(', ')} and ${targetModules.length - 6} more`
        : targetModules.join(', ');
    prompts.log.message(`Targets: ${colors.dim(targetModuleSummary)}`);
  }

  const cwd = ctx.env.cwd ?? process.cwd();

  const files = await glob(include, {
    cwd,
    ignore: ['node_modules'],
    absolute: true
  });

  if (files.length === 0) {
    prompts.cancel(
      `No files found matching the pattern: ${colors.dim(include)}`
    );
    return;
  }

  for (const filename of files) {
    const log = prompts.taskLog({
      title: `${filename}...`,
      limit: 5
    });

    log.message(`loading ${filename}`);

    const source = await readFile(filename, 'utf8');

    let totalMigrations = 0;

    for (const replacement of selectedReplacements) {
      if (
        replacement.condition !== undefined &&
        (await replacement.condition(filename, source)) === false
      ) {
        continue;
      }

      log.message(`migrating ${replacement.from} to ${replacement.to}`);
      // TODO (43081j): create the factory once and re-use it
      const result = await replacement.factory({}).transform({
        file: {
          filename,
          source
        }
      });
      log.message(`writing ${filename}`);
      if (!dryRun) {
        await writeFile(filename, result, 'utf8');
      }
      totalMigrations++;
    }
    log.success(`${filename} ${colors.dim(`(${totalMigrations} migrated)`)}`);
  }

  prompts.outro('Migration complete.');
}
