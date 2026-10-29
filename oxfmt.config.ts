import {defineConfig} from 'oxfmt';

export default defineConfig({
  bracketSpacing: false,
  printWidth: 80,
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'none',
  useTabs: false,
  arrowParens: 'always',
  endOfLine: 'lf',
  sortImports: false,
  sortPackageJson: true,
  ignorePatterns: ['test/fixtures/**']
});
