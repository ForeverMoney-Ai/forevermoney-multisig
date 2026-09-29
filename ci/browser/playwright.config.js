const { defineConfig } = require('@playwright/test')
module.exports = defineConfig({
  testDir: '.', testMatch: '*.spec.js', timeout: 90000, retries: 1,
  use: { baseURL: 'http://127.0.0.1:8772', browserName: 'chromium', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'python3 server.py', url: 'http://127.0.0.1:8772', timeout: 30000 },
})
