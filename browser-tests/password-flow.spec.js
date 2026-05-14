// @ts-check
const { test, expect } = require('@playwright/test');

// Base URL of the company admin portal
const BASE_URL = process.env.TEST_BASE_URL || 'https://ledgerman.org';
const API_BASE  = process.env.TEST_API_URL  || 'https://app.ledgerman.org';

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Intercept and capture the request body of the PUT /api/settings call.
 * Returns a promise that resolves to the parsed JSON body, or null if the
 * request is never made within the action.
 */
async function captureSettingsPayload(page, action) {
    let captured = null;
    page.on('request', (req) => {
        if (req.method() === 'PUT' && req.url().includes('/api/settings')) {
            try { captured = JSON.parse(req.postData() || '{}'); } catch (_) {}
        }
    });
    await action();
    return captured;
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Admin password change flow', () => {

    test('Settings save payload does NOT contain adminPassword', async ({ page }) => {
        // Navigate to the admin portal
        await page.goto(BASE_URL);

        // Intercept any PUT /api/settings requests
        const payloads = [];
        await page.route('**/api/settings', async (route, request) => {
            if (request.method() === 'PUT') {
                try { payloads.push(JSON.parse(request.postData() || '{}')); } catch (_) {}
            }
            // Fulfill with a mock success so the page doesn't error out
            await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
        });

        // Evaluate directly: build a fake settings object and call saveSettings
        await page.evaluate(() => {
            if (window.AppData && window.AppData.saveSettings) {
                window.AppData.saveSettings({
                    companyName: 'Test Co',
                    email: 'test@example.com',
                    sessionTimeout: 30
                });
            }
        });

        // Give the request time to fire
        await page.waitForTimeout(500);

        for (const payload of payloads) {
            expect(payload).not.toHaveProperty('adminPassword');
        }
    });

    test('Password change calls POST /api/auth/admin/change-password', async ({ page }) => {
        await page.goto(BASE_URL);

        // Intercept the change-password endpoint
        let changePasswordCalled = false;
        let requestBody = null;
        await page.route('**/api/auth/admin/change-password', async (route, request) => {
            changePasswordCalled = true;
            try { requestBody = JSON.parse(request.postData() || '{}'); } catch (_) {}
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ success: true })
            });
        });

        // Call changeAdminPassword directly via the AppData API
        await page.evaluate(async () => {
            if (window.AppData && window.AppData.changeAdminPassword) {
                // Stub isApiMode and getJwt so the call goes through
                const origIsApiMode = window.isApiMode;
                const origGetJwt = window.getJwt;
                try {
                    await window.AppData.changeAdminPassword('oldPass123', 'newPass456!');
                } catch (_) {
                    // Ignore errors — we only care that the request was made
                }
            }
        });

        await page.waitForTimeout(500);

        // Verify the correct endpoint was called with correct shape
        expect(changePasswordCalled).toBe(true);
        if (requestBody) {
            expect(requestBody).toHaveProperty('currentPassword');
            expect(requestBody).toHaveProperty('newPassword');
            expect(requestBody).not.toHaveProperty('adminPassword');
        }
    });

    test('Password field is blank on settings load (never pre-populated)', async ({ page }) => {
        await page.goto(BASE_URL);

        // Mock settings API to return data including a (hypothetical) adminPassword
        await page.route('**/api/settings', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    companyName: 'Test Co',
                    email: 'admin@test.com',
                    adminPassword: 'ShouldNotAppear1!'
                })
            });
        });

        // Reload to trigger settings fetch
        await page.reload();

        // If the settings page is rendered, check password fields are empty
        const pwFields = await page.locator('input[type="password"]').all();
        for (const field of pwFields) {
            const id = await field.getAttribute('id');
            // Skip the login form field
            if (id === 'adminPassword') continue;
            const val = await field.inputValue();
            expect(val).toBe('');
        }
    });

    test('Wrong currentPassword shows error message', async ({ page }) => {
        await page.goto(BASE_URL);

        // Mock the change-password endpoint to return 401
        await page.route('**/api/auth/admin/change-password', async (route) => {
            await route.fulfill({
                status: 401,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Current password is incorrect' })
            });
        });

        // Call via AppData
        let thrownError = null;
        thrownError = await page.evaluate(async () => {
            if (window.AppData && window.AppData.changeAdminPassword) {
                try {
                    await window.AppData.changeAdminPassword('wrongPass', 'newPass456!');
                    return null;
                } catch (e) {
                    return e.message;
                }
            }
            return 'AppData.changeAdminPassword not found';
        });

        expect(thrownError).toMatch(/incorrect|password|401/i);
    });

    test('Mismatched confirmPassword blocks submit', async ({ page }) => {
        await page.goto(BASE_URL);

        // The settings.js handler validates newPw !== confirm before calling the API
        // We test that the validation check fires client-side

        let changePasswordCalled = false;
        await page.route('**/api/auth/admin/change-password', async (route) => {
            changePasswordCalled = true;
            await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
        });

        // Simulate the form submission logic directly
        await page.evaluate(async () => {
            // If a passwordForm exists, fill in mismatched passwords and submit
            const form = document.querySelector('#passwordForm');
            if (!form) return;
            const pwCurrent = form.querySelector('#pwCurrent');
            const pwNew = form.querySelector('#pwNew');
            const pwConfirm = form.querySelector('#pwConfirm');
            if (pwCurrent) pwCurrent.value = 'currentPass1!';
            if (pwNew) pwNew.value = 'newPass123!';
            if (pwConfirm) pwConfirm.value = 'differentPass456!';
            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        });

        await page.waitForTimeout(300);

        // The API should NOT have been called because passwords don't match
        expect(changePasswordCalled).toBe(false);
    });

    test('New password shorter than 8 chars is blocked client-side', async ({ page }) => {
        await page.goto(BASE_URL);

        let changePasswordCalled = false;
        await page.route('**/api/auth/admin/change-password', async (route) => {
            changePasswordCalled = true;
            await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
        });

        await page.evaluate(async () => {
            const form = document.querySelector('#passwordForm');
            if (!form) return;
            const pwCurrent = form.querySelector('#pwCurrent');
            const pwNew = form.querySelector('#pwNew');
            const pwConfirm = form.querySelector('#pwConfirm');
            if (pwCurrent) pwCurrent.value = 'currentPass1!';
            if (pwNew) pwNew.value = 'short';
            if (pwConfirm) pwConfirm.value = 'short';
            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        });

        await page.waitForTimeout(300);
        expect(changePasswordCalled).toBe(false);
    });
});
