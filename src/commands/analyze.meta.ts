import type {PackType} from '../types.js';

export const meta = {
  name: 'analyze',
  description: 'Analyze the project for any warnings or errors',
  args: {
    pack: {
      type: 'enum',
      choices: [
        'auto',
        'npm',
        'yarn',
        'pnpm',
        'bun',
        'none'
      ] satisfies PackType[],
      default: 'auto',
      description: `Package manager to use for packing`
    },
    'log-level': {
      type: 'enum',
      choices: ['debug', 'info', 'warn', 'error'],
      default: 'info',
      description: 'Set the log level (debug | info | warn | error)'
    },
    manifest: {
      type: 'string',
      array: true,
      description:
        'Path(s) to custom manifest file(s) for module replacements analysis'
    },
    attw: {
      type: 'boolean',
      default: false,
      description: 'Enable Are The Types Wrong analysis'
    }
  }
} as const;
