export const meta = {
  name: 'analyze',
  description: 'Analyze the project for any warnings or errors',
  args: {
    'log-level': {
      type: 'enum',
      choices: ['debug', 'info', 'warn', 'error'],
      default: 'info',
      description:
        'Which severities are printed (pretty output) and included in JSON messages unless --json-full is set; also the minimum severity for a non-zero exit code (debug | info | warn | error)'
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
        'Output results as JSON to stdout (messages respect --log-level unless --json-full)'
    },
    'json-full': {
      type: 'boolean',
      default: false,
      description:
        'With --json, include every diagnostic in messages regardless of --log-level (exit code still follows --log-level). Ignored without --json.'
    }
  }
} as const;
