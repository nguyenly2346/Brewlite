import { defineConfig, devices } from '@playwright/test';

// Chạy được trên local, CI và production chỉ bằng cách đổi biến môi trường:
//   E2E_BASE_URL=https://<web-url> E2E_API_URL=https://<api-url> npx playwright test
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // các test dùng chung DB mẫu, chạy tuần tự cho ổn định
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }]]
    : [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      // BrewLite là mobile-first/PWA nên test trên viewport điện thoại
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
  ],
});
