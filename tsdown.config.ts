import {defineConfig} from 'tsdown';

export default defineConfig({
  entry: ['./src/index.ts', './src/cli.ts'],
  target: 'node22',
  platform: 'node',
  format: 'esm',
  dts: {
    enabled: true,
    generator: 'tsgo'
  },
  unbundle: false,
  exports: {
    bin: {
      'e18e-cli': './src/cli.ts'
    }
  },
  publint: true,
  attw: true
});
