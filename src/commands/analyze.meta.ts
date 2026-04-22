export const meta = {
  name: 'analyze',
  description: 'Analyze the project for any warnings or errors',
  args: {
    'log-level': {
      type: 'enum',
      choices: ['debug', 'info', 'warn', 'error'],
      default: 'info',
      description:
        'Minimum severity for a non-zero exit code, and enables debug logging when set to debug (debug | info | warn | error)'
    },
    quiet: {
      type: 'boolean',
      default: false,
      description:
        'Only show errors in Results and JSON messages (same idea as ESLint --quiet). Overrides --report-level.'
    },
    'report-level': {
      type: 'enum',
      choices: ['auto', 'debug', 'info', 'warn', 'error'],
      default: 'auto',
      description:
        'Which severities appear in Results and in JSON messages when not using --quiet. auto: follow --log-level (debug | info | warn | error)'
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
      description:
        'Output results as JSON to stdout (messages follow --quiet or resolved --report-level)'
    }
  }
} as const;
