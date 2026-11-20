import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '*.browser.test.ts',
  workers: 1,
  timeout: 60_000,
  reporter: 'list',
});
