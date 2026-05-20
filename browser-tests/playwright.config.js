// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
    testDir: '.',
    timeout: 30000,
    retries: 0,
    reporter: 'html',
    use: {
        // Use app.ledgerman.org directly — ledgerman.org 301-redirects and adds latency
        baseURL: process.env.TEST_BASE_URL || 'https://app.ledgerman.org',
        headless: true,
    },
    projects: [
        // Desktop — runs all specs (password-flow, etc.)
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },

        // Mobile viewports — used by mobile-regression.spec.js
        // Uses Chromium with mobile viewport emulation (WebKit not required)
        // Run with: npm run test:mobile
        {
            name: 'mobile-375',
            use: {
                browserName: 'chromium',
                viewport: { width: 375, height: 667 },
                deviceScaleFactor: 2,
                isMobile: true,
                hasTouch: true,
                userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
            },
        },
        {
            name: 'mobile-390',
            use: {
                browserName: 'chromium',
                viewport: { width: 390, height: 844 },
                deviceScaleFactor: 3,
                isMobile: true,
                hasTouch: true,
                userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
            },
        },
        {
            name: 'mobile-414',
            use: {
                browserName: 'chromium',
                viewport: { width: 414, height: 736 },
                deviceScaleFactor: 3,
                isMobile: true,
                hasTouch: true,
                userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
            },
        },
    ],
});
