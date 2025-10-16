export const meta = {
  name: 'migrate',
  description: 'Migrate from a package to a more performant alternative.',
  args: {
    all: {
      type: 'boolean',
      default: false,
      description: 'Run all available migrations'
    },
    'dry-run': {
      type: 'boolean',
      default: false,
      description: `Don't apply any fixes, only show what would change.`
    },
    include: {
      type: 'string',
      default: '**/*.{ts,js}',
      description: 'Files to migrate'
    },
    interactive: {
      type: 'boolean',
      default: false,
      description: 'Run in interactive mode.'
    }
  }
} as const;
