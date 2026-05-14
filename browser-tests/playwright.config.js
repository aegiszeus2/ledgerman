// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
    testDir: '.',
    timeout: 30000,
    retries: 0,
    reporter: 'html',
    use: {
        baseURL: process.env.TEST_BASE_URL || 'https://ledgerman.org',
        headless: true,
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ],
});
