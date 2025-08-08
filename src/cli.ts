import {createRequire} from 'node:module';
import {cli, define, lazy, type LazyCommand} from 'gunshi';
import c from 'picocolors';
import {meta as analyzeMeta} from './commands/analyze.meta.js';
import {meta as migrateMeta} from './commands/migrate.meta.js';
import {renderUsage} from 'gunshi/renderer';

const version = createRequire(import.meta.url)('../package.json').version;

const defaultCommand = define({
  args: {},
  async run(ctx) {
    const usage = await renderUsage(ctx);
    console.log(usage);
  }
});

const analyzeCommand = async () => {
  const {run} = await import('./commands/analyze.js');
  return run;
};
const migrateCommand = async () => {
  const {run} = await import('./commands/migrate.js');
  return run;
};

const subCommands = new Map<string, LazyCommand<any>>([
  ['analyze', lazy(analyzeCommand, analyzeMeta)],
  ['migrate', lazy(migrateCommand, migrateMeta)]
]);

cli(process.argv.slice(2), defaultCommand, {
  name: 'cli',
  version,
  description: `${c.cyan('e18e')}`,
  subCommands
});
