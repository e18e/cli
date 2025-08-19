import eslintjs from '@eslint/js';
import {configs as tseslintConfigs} from 'typescript-eslint';

const {configs: eslintConfigs} = eslintjs;

export default [
  {
    ...eslintConfigs.recommended,
    files: ['src/**/*.ts']
  },
  ...tseslintConfigs.strict,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_'}
      ]
    }
  }
];
