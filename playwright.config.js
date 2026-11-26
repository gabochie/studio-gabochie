import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  // Flaky tests must fail the release. Local runs may retry for convenience.
  retries: process.env.CI ? 0 : 1,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:8788',
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
