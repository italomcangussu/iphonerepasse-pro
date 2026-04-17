import { defineConfig, devices } from '@playwright/test';
import { ADMIN_STORAGE_STATE, SELLER_STORAGE_STATE } from './tests/smoke/utils/constants';
import { loadSmokeEnv } from './tests/smoke/utils/smokeEnv';

const smokeEnv = loadSmokeEnv();

export default defineConfig({
  testDir: './tests/smoke',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 1,
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  reporter: [
    ['list'],
    ['json', { outputFile: 'reports/smoke/playwright-results.json' }],
    ['html', { open: 'never', outputFolder: 'reports/smoke/playwright-html' }],
  ],
  use: {
    baseURL: smokeEnv.baseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    ...devices['Desktop Chrome'],
  },
  outputDir: 'reports/smoke/test-results',
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4174',
    url: smokeEnv.baseUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'setup-admin',
      testMatch: /auth\.setup\.admin\.spec\.ts/,
    },
    {
      name: 'setup-seller',
      testMatch: /auth\.setup\.seller\.spec\.ts/,
    },
    {
      name: 'admin',
      testMatch: /.*\.smoke\.spec\.ts/,
      dependencies: ['setup-admin'],
      use: {
        storageState: ADMIN_STORAGE_STATE,
      },
    },
    {
      name: 'seller',
      testMatch: /.*\.smoke\.spec\.ts/,
      dependencies: ['setup-seller'],
      use: {
        storageState: SELLER_STORAGE_STATE,
      },
    },
  ],
});
