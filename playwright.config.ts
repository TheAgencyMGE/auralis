import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: /.*\.spec\.ts/,
  timeout: 60_000,
  // One Electron instance at a time: they compete for focus and the GPU.
  workers: 1,
  reporter: [['list']],
  retries: 0
})
