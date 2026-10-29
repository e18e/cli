import {defineConfig} from 'oxlint';

export default defineConfig({
  plugins: ['oxc', 'typescript', 'import', 'jsdoc', 'promise', 'vitest'],
  categories: {
    correctness: 'error'
  },
  rules: {
    'vitest/prefer-snapshot-hint': 'off'
  },
  options: {
    typeAware: true
  },
  ignorePatterns: ['test/fixtures/**']
});
