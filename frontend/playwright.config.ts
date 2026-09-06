import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure', ...devices['Desktop Chrome'] },
  webServer: [
    { command: 'python -m uvicorn app.main:app --host 127.0.0.1 --port 8000', cwd: '../backend', port: 8000, reuseExistingServer: true, timeout: 30_000 },
    { command: 'npm run dev -- --host 127.0.0.1 --port 5173', cwd: '.', port: 5173, reuseExistingServer: true, timeout: 30_000 },
  ],
})
