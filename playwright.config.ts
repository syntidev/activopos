import { defineConfig, devices } from '@playwright/test'
import path from 'path'

const AUTH_FILE = path.join(__dirname, 'tests', '.auth-state.json')

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'off',
    locale: 'es-VE',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_FILE,
      },
      // auth.setup.ts generates the AUTH_FILE — run "npx playwright test auth.setup.ts" to refresh it
      // when rate limiter clears or on fresh env
    },
  ],
})
