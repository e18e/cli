export const meta = {
  name: 'analyze',
  description: 'Analyze the project for any warnings or errors',
  args: {
    'base-tarball': {
      type: 'string',
      multiple: true,
      description:
        'Path to base tarball file(s) (e.g. main) to analyze (globs supported)'
    },
    'target-tarball': {
      type: 'string',
      multiple: true,
      description:
        'Path to target tarball file(s) (e.g. PR branch) to analyze (globs supported)'
    },
    'log-level': {
      type: 'enum',
      choices: ['debug', 'info', 'warn', 'error'],
      default: 'info',
      description: 'Set the log level (debug | info | warn | error)'
    },
    manifest: {
      type: 'string',
      multiple: true,
      description:
        'Path(s) to custom manifest file(s) for module replacements analysis'
    }
  }
} as const;
