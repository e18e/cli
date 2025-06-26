import {createRequire} from 'node:module';
import {cli, define, lazy, type LazyCommand} from 'gunshi';
import c from 'picocolors';
import {meta as analyzeMeta} from './commands/analyze.meta.js';
import {meta as migrateMeta} from './commands/migrate.meta.js';
import {pino} from 'pino';
import {renderUsage} from 'gunshi/renderer';

const version = createRequire(import.meta.url)('../package.json').version;

// Create a logger instance with pretty printing for development
export const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  }
});

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
  // TODO (43081j): get rid of these casts
  ['analyze', lazy(analyzeCommand, analyzeMeta) as LazyCommand<any>],
  ['migrate', lazy(migrateCommand, migrateMeta) as LazyCommand<any>]
]);

cli(process.argv.slice(2), defaultCommand, {
  name: 'cli',
  version,
  description: `${c.cyan('e18e')}`,
  subCommands
});
