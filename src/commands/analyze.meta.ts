export const meta = {
  name: 'analyze',
  description: 'Analyze the project for any warnings or errors',
  args: {
    'log-level': {
      type: 'enum',
      choices: ['debug', 'info', 'warn', 'error'],
      default: 'info',
      description:
        'Set the log level and the minimum severity that causes a non-zero exit code (debug | info | warn | error)'
    },
    manifest: {
      type: 'string',
      multiple: true,
      description:
        'Path(s) to custom manifest file(s) for module replacements analysis'
    },
    json: {
      type: 'boolean',
      default: false,
      description: 'Output results as JSON to stdout'
    },
    'build-dir': {
      type: 'string',
      description:
        'Path to build output directory to scan for vendored polyfills (e.g. .next, dist, build)'
    }
  }
} as const;
