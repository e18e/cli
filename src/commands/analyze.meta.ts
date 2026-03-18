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
    categories: {
      type: 'string',
      default: 'all',
      description:
        'Manifest categories for replacement analysis: all, native, preferred, micro-utilities, or comma-separated (e.g. native,preferred). Default: all.'
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
    }
  }
} as const;
