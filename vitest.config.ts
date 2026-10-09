import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    // Run through scripts/test-unit.mjs (Electron's Node, which has FTS5).
    execArgv: ['--no-warnings']
  }
})
