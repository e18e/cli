import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
  ],
  test: {
    env: {
      FORCE_COLOR: '1'
    },
    reporters: 'dot',
    include: [
      'packages/**/*.test.ts',
      'src/**/*.test.ts',
      'test/**/*.test.ts'
    ]
  }
})
