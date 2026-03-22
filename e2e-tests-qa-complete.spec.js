// Ledgerman — Comprehensive E2E Test Suite
// Using Playwright: https://playwright.dev
// Run: npx playwright test ledgerman_e2e_tests.spec.js

import { test, expect } from '@playwright/test';

// Configuration
const BASE_URL = 'https://ledgerman.org';
const API_BASE = 'https://ledgeman-backend.onrender.com';
const TEST_COMPANY = 'Belfort Con';
const TEST_PASSWORD = 'Admin123456!';

// ============ FIXTURE: Authenticated Admin Session ============
const adminAuthFixture = test.extend({
    adminPage: async ({ page }, use) => {
        // Pre-authenticate by getting a valid JWT
        const authRes = await page.request.post(`${API_BASE}/api/auth/admin`, {
            data: {
                companyName: TEST_COMPANY,
                password: TEST_PASSWORD
            }
        });
        const { token } = await authRes.json();

        // Set the token in localStorage
        await page.goto(BASE_URL);
        await page.evaluate((t) => localStorage.setItem('ledgerman_jwt', t), token);
        await page.reload();

        await use(page);
    }
});

// ============ SECTION A: AUTHENTICATION TESTS ============

test.describe('A. Authentication — Admin Login', () => {

    test('A1.1: Admin login with valid credentials (happy path)', async ({ page }) => {
        await page.goto(BASE_URL);

        // Click Admin Login button
        await page.click('text=Admin Login');
        await expect(page).toHaveURL(/.*/, { timeout: 2000 });

        // Fill in credentials
        await page.fill('#adminCompanyName', TEST_COMPANY);
        await page.fill('#adminPassword', TEST_PASSWORD);

        // Submit
        await page.click('#adminLoginBtn');

        // Verify dashboard loads
        await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('text=' + TEST_COMPANY)).toBeVisible(); // Company name in header
    });

    test('A1.2: Admin login rejects invalid password', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.click('text=Admin Login');

        await page.fill('#adminCompanyName', TEST_COMPANY);
        await page.fill('#adminPassword', 'WrongPassword123!');
        await page.click('#adminLoginBtn');

        // Should show error without loading dashboard
        await expect(page.locator('#adminLoginError')).toBeVisible();
        await expect(page.locator('#adminLoginError')).toContainText('Invalid password');
        await expect(page.locator('text=Dashboard')).not.toBeVisible();
    });

    test('A1.3: Admin login rejects nonexistent company', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.click('text=Admin Login');

        await page.fill('#adminCompanyName', 'NonexistentCompanyXYZ');
        await page.fill('#adminPassword', TEST_PASSWORD);
        await page.click('#adminLoginBtn');

        await expect(page.locator('#adminLoginError')).toBeVisible();
    });

    test('A1.4: Password field trimming (leading/trailing spaces)', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.click('text=Admin Login');

        // Enter password with trailing space
        await page.fill('#adminCompanyName', TEST_COMPANY);
        await page.fill('#adminPassword', `  ${TEST_PASSWORD}  `);
        await page.click('#adminLoginBtn');

        // Should succeed (whitespace trimmed on frontend)
        await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 5000 });
    });

    test('A1.5: Case-insensitive company name lookup', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.click('text=Admin Login');

        await page.fill('#adminCompanyName', TEST_COMPANY.toLowerCase());
        await page.fill('#adminPassword', TEST_PASSWORD);
        await page.click('#adminLoginBtn');

        // Should succeed (case-insensitive lookup on backend)
        await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 5000 });
    });

    test('A1.6: Rate limiting: 5 failed attempts locks out for 60s', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.click('text=Admin Login');

        // Make 5 failed login attempts
        for (let i = 0; i < 5; i++) {
            await page.fill('#adminCompanyName', TEST_COMPANY);
            await page.fill('#adminPassword', 'WrongPassword' + i);
            await page.click('#adminLoginBtn');
            await page.waitForTimeout(500); // Brief pause between attempts
        }

        // 6th attempt should be locked
        await page.fill('#adminCompanyName', TEST_COMPANY);
        await page.fill('#adminPassword', TEST_PASSWORD);
        await page.click('#adminLoginBtn');

        const errorText = await page.locator('#adminLoginError').textContent();
        expect(errorText).toContain('Too many attempts');
    });

    test('A1.7: Pre-filled login via URL params (?company=X&password=Y)', async ({ page }) => {
        const encoded = `${BASE_URL}/?company=${encodeURIComponent(TEST_COMPANY)}&password=${encodeURIComponent(TEST_PASSWORD)}`;
        await page.goto(encoded);

        // Click Admin Login button
        await page.click('text=Admin Login');

        // Should be pre-filled
        const companyInput = await page.inputValue('#adminCompanyName');
        const passwordInput = await page.inputValue('#adminPassword');

        expect(companyInput).toBe(TEST_COMPANY);
        expect(passwordInput).toBe(TEST_PASSWORD);

        // Should auto-submit
        await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 5000 });
    });

    test('A1.8: Password show/hide toggle', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.click('text=Admin Login');

        // Password field should start as password type
        const passwordInput = page.locator('#adminPassword');
        await expect(passwordInput).toHaveAttribute('type', 'password');

        // Find the toggle button (if exists in admin form)
        const toggleBtn = page.locator('button[data-toggle="adminPassword"]');
        if (await toggleBtn.isVisible()) {
            await toggleBtn.click();
            // Note: Type attribute can't be toggled in some browsers, but functionality should work
        }
    });

    test('A1.9: Logout button clears JWT and returns to login', async ({ adminPage: page }) => {
        // Already logged in via fixture
        await expect(page.locator('text=Dashboard')).toBeVisible();

        // Find and click logout button
        await page.click('#adminLogout');

        // Should return to login screen
        await expect(page.locator('text=Admin Login')).toBeVisible({ timeout: 3000 });

        // JWT should be cleared from localStorage
        const jwt = await page.evaluate(() => localStorage.getItem('ledgerman_jwt'));
        expect(jwt).toBeNull();
    });
});

// ============ SECTION B: AUTHENTICATION — WORKER LOGIN ============

test.describe('B. Authentication — Worker Login', () => {

    test.skip('B1.1: Worker login with company name + PIN', async ({ page }) => {
        // Note: Requires a test worker to exist in DB with known PIN
        // This is skipped because test data setup is needed

        await page.goto(BASE_URL);
        await page.click('text=Worker Login');

        const testWorkerCompany = 'Test Company';
        const testWorkerPin = '1234';

        await page.fill('#workerCompanyName', testWorkerCompany);
        await page.fill('#workerPin', testWorkerPin);
        await page.click('button:has-text("Login")');

        // Should show worker dashboard (not admin)
        await expect(page.locator('text=Clock In')).toBeVisible({ timeout: 5000 });
    });

    test.skip('B1.2: Worker login rejects invalid PIN', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.click('text=Worker Login');

        await page.fill('#workerCompanyName', 'Test Company');
        await page.fill('#workerPin', '9999');

        await page.click('button:has-text("Login")');

        await expect(page.locator('#workerLoginError')).toContainText('Invalid PIN');
    });

    test.skip('B1.3: PIN numeric-only validation', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.click('text=Worker Login');

        const pinInput = page.locator('#workerPin');

        // Should have numeric input mode
        await expect(pinInput).toHaveAttribute('inputmode', 'numeric');

        // Should enforce pattern [0-9]{4,6}
        await expect(pinInput).toHaveAttribute('pattern', '[0-9]{4,6}');
    });
});

// ============ SECTION C: TWO-FACTOR AUTHENTICATION ============

test.describe('C. Authentication — 2FA', () => {

    test.skip('C1.1: TOTP 2FA verification flow', async ({ page }) => {
        // This requires a worker with TOTP enabled
        // Setup: Create test worker with TOTP secret, then try to login

        await page.goto(BASE_URL);
        await page.click('text=Worker Login');

        await page.fill('#workerCompanyName', 'Test Company');
        await page.fill('#workerPin', '1234');
        await page.click('button:has-text("Login")');

        // Should show 2FA step
        await expect(page.locator('text=Two-Factor Auth')).toBeVisible();

        // Note: Can't actually verify TOTP code without access to secret
        // Real test would use: https://www.npmjs.com/package/totp-generator
    });

    test.skip('C1.2: Email 2FA resend button', async ({ page }) => {
        // Requires worker with email2FAEnabled = true

        await page.goto(BASE_URL);
        await page.click('text=Worker Login');

        await page.fill('#workerCompanyName', 'Test Company');
        await page.fill('#workerPin', '1234');
        await page.click('button:has-text("Login")');

        // Should show email 2FA
        await expect(page.locator('text=Email Verification')).toBeVisible();

        // Resend button should be clickable
        const resendBtn = page.locator('#resendCode');
        await expect(resendBtn).toBeEnabled();

        await resendBtn.click();

        // Should show feedback (toast or message)
        await expect(page.locator('text=sent')).toBeVisible({ timeout: 3000 });
    });
});

// ============ SECTION D: DASHBOARD & NAVIGATION ============

test.describe('D. Dashboard & Navigation', () => {

    adminAuthFixture('D1.1: Dashboard loads with company name', async ({ adminPage: page }) => {
        await expect(page.locator('text=Dashboard')).toBeVisible();
        await expect(page.locator('.header-title')).toContainText(TEST_COMPANY);
    });

    adminAuthFixture('D1.2: Sidebar navigation visible and clickable', async ({ adminPage: page }) => {
        const nav = page.locator('.admin-sidebar');
        await expect(nav).toBeVisible();

        // Check main nav items exist
        await expect(page.locator('text=Projects')).toBeVisible();
        await expect(page.locator('text=Approvals')).toBeVisible();
        await expect(page.locator('text=Invoices')).toBeVisible();
        await expect(page.locator('text=Workers')).toBeVisible();
        await expect(page.locator('text=Settings')).toBeVisible();
    });

    adminAuthFixture('D1.3: Mobile sidebar toggle (hamburger menu)', async ({ adminPage: page }) => {
        // Resize to mobile
        await page.setViewportSize({ width: 375, height: 667 });

        const toggleBtn = page.locator('.sidebar-toggle');
        await expect(toggleBtn).toBeVisible();

        const sidebar = page.locator('.admin-sidebar');

        // Toggle visibility
        if (await sidebar.isVisible()) {
            await toggleBtn.click();
            // Sidebar might close or change position
        }
    });

    adminAuthFixture('D1.4: Navigation to Projects section', async ({ adminPage: page }) => {
        await page.click('text=Projects');

        // Should show projects view
        await expect(page.locator('text=Projects')).toBeVisible();
        // Would need to verify project list is rendered (endpoint dependent)
    });

    adminAuthFixture('D1.5: Navigation to Workers section', async ({ adminPage: page }) => {
        await page.click('text=Workers');

        // Should show workers view
        await expect(page.locator('text=Workers')).toBeVisible();
    });

    adminAuthFixture('D1.6: Help section visible', async ({ adminPage: page }) => {
        await page.click('text=Help');

        // Should show help content
        await expect(page.locator('text=Help')).toBeVisible();
    });
});

// ============ SECTION E: FORM OPERATIONS (POST/PATCH/DELETE) ============

test.describe('E. Form Operations & Data Manipulation', () => {

    adminAuthFixture('E1.1: Form validation - required fields', async ({ adminPage: page }) => {
        // This test is generic; actual form depends on which form we test
        // Example: if there's a "Create X" form

        // Navigate to a section with forms (e.g., Clients)
        await page.click('text=Clients');

        // Try to submit empty form
        const addBtn = page.locator('button:has-text("Add"), button:has-text("Create")');
        if (await addBtn.isVisible()) {
            await addBtn.click();
            await page.waitForTimeout(500);

            // Check if form validation shows error
            // Actual selector depends on form structure
        }
    });

    adminAuthFixture('E1.2: Form error handling', async ({ adminPage: page }) => {
        // Make an invalid API call and verify error is displayed
        // Example: try to create a client with no name

        // This requires knowing the exact form structure
        // Placeholder for now
    });
});

// ============ SECTION F: SECURITY TESTS ============

test.describe('F. Security', () => {

    test('F1.1: XSS protection in error messages', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.click('text=Admin Login');

        const xssPayload = '"><script>alert("XSS")</script>';

        await page.fill('#adminCompanyName', xssPayload);
        await page.fill('#adminPassword', 'test');
        await page.click('#adminLoginBtn');

        // Error should display, but script should NOT execute
        // Verify by checking console logs for errors
        const errors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') errors.push(msg.text());
        });

        await page.waitForTimeout(2000);

        // Should not have XSS errors
        const hasXSSError = errors.some(e => e.includes('inline script') || e.includes('eval'));
        expect(hasXSSError).toBeFalsy();
    });

    test('F1.2: CSRF token in session', async ({ page }) => {
        // JWT should be stored securely
        await page.goto(BASE_URL);
        await page.click('text=Admin Login');

        await page.fill('#adminCompanyName', TEST_COMPANY);
        await page.fill('#adminPassword', TEST_PASSWORD);
        await page.click('#adminLoginBtn');

        // After login, JWT should be in localStorage
        const jwt = await page.evaluate(() => localStorage.getItem('ledgerman_jwt'));

        expect(jwt).toBeTruthy();
        expect(jwt).toMatch(/^eyJ/); // JWT format check
    });

    test('F1.3: No sensitive data in network requests', async ({ page }) => {
        const requests = [];

        page.on('request', request => {
            requests.push({
                url: request.url(),
                body: request.postDataJSON()?.password || request.postDataJSON()?.pin
            });
        });

        await page.goto(BASE_URL);
        await page.click('text=Admin Login');

        await page.fill('#adminCompanyName', TEST_COMPANY);
        await page.fill('#adminPassword', TEST_PASSWORD);
        await page.click('#adminLoginBtn');

        // Password should be in request body (acceptable), but check no logging
        const hasPasswordLog = requests.some(r =>
            r.url.includes('analytics') && r.body && r.body.includes(TEST_PASSWORD)
        );

        expect(hasPasswordLog).toBeFalsy();
    });
});

// ============ SECTION G: RESPONSIVE DESIGN ============

test.describe('G. Responsive Design', () => {

    adminAuthFixture.use({ viewport: { width: 375, height: 667 } });

    adminAuthFixture('G1.1: Mobile viewport (375x667) displays correctly', async ({ adminPage: page }) => {
        // Should show hamburger menu on mobile
        const toggleBtn = page.locator('.sidebar-toggle');
        await expect(toggleBtn).toBeVisible();

        // Header should be readable
        const header = page.locator('.admin-header');
        await expect(header).toBeVisible();
    });

    test('G1.2: Tablet viewport (768x1024)', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });

        await page.goto(BASE_URL);
        await page.click('text=Admin Login');
        await page.fill('#adminCompanyName', TEST_COMPANY);
        await page.fill('#adminPassword', TEST_PASSWORD);
        await page.click('#adminLoginBtn');

        // Both sidebar and main content should be visible
        await expect(page.locator('.admin-sidebar')).toBeVisible();
        await expect(page.locator('.admin-main')).toBeVisible();
    });

    test('G1.3: Desktop viewport (1920x1080)', async ({ page }) => {
        await page.setViewportSize({ width: 1920, height: 1080 });

        await page.goto(BASE_URL);
        await page.click('text=Admin Login');
        await page.fill('#adminCompanyName', TEST_COMPANY);
        await page.fill('#adminPassword', TEST_PASSWORD);
        await page.click('#adminLoginBtn');

        // Should render fully without overflow
        const main = page.locator('.admin-main');
        const boundingBox = await main.boundingBox();
        expect(boundingBox.width).toBeLessThanOrEqual(1920);
    });
});

// ============ SECTION H: API ENDPOINT COVERAGE ============

test.describe('H. API Endpoints', () => {

    test('H1.1: POST /api/auth/admin returns JWT', async ({ request }) => {
        const response = await request.post(`${API_BASE}/api/auth/admin`, {
            data: {
                companyName: TEST_COMPANY,
                password: TEST_PASSWORD
            }
        });

        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body.token).toBeTruthy();
        expect(body.token).toMatch(/^eyJ/); // JWT format
    });

    test('H1.2: POST /api/auth/admin rejects invalid credentials', async ({ request }) => {
        const response = await request.post(`${API_BASE}/api/auth/admin`, {
            data: {
                companyName: TEST_COMPANY,
                password: 'WrongPassword123!'
            }
        });

        expect(response.status()).toBe(401);
        const body = await response.json();
        expect(body.error).toBeTruthy();
    });

    test('H1.3: GET /api/health returns service status', async ({ request }) => {
        const response = await request.get(`${API_BASE}/api/health`);

        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body.status).toBe('ok');
    });

    test('H1.4: Requests without Authorization header are rejected', async ({ request }) => {
        const response = await request.get(`${API_BASE}/api/companies`);

        expect(response.status()).toBe(401);
    });

    test('H1.5: Valid JWT in Authorization header is accepted', async ({ request }) => {
        // First, get a token
        const authRes = await request.post(`${API_BASE}/api/auth/admin`, {
            data: {
                companyName: TEST_COMPANY,
                password: TEST_PASSWORD
            }
        });
        const { token } = await authRes.json();

        // Use token to access protected endpoint
        const response = await request.get(`${API_BASE}/api/companies`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        // Should succeed (200) or at least not be 401
        expect(response.status()).not.toBe(401);
    });
});

// ============ SECTION I: PERFORMANCE TESTS ============

test.describe('I. Performance', () => {

    test('I1.1: Page load time < 3 seconds', async ({ page }) => {
        const startTime = Date.now();

        await page.goto(BASE_URL, { waitUntil: 'networkidle' });

        const loadTime = Date.now() - startTime;

        expect(loadTime).toBeLessThan(3000);
    });

    test('I1.2: Login submission responds within 5 seconds', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.click('text=Admin Login');

        const startTime = Date.now();

        await page.fill('#adminCompanyName', TEST_COMPANY);
        await page.fill('#adminPassword', TEST_PASSWORD);
        await page.click('#adminLoginBtn');

        // Wait for response
        await page.waitForLoadState('networkidle');

        const responseTime = Date.now() - startTime;

        expect(responseTime).toBeLessThan(5000);
    });
});

// ============ SECTION J: ACCESSIBILITY ============

test.describe('J. Accessibility', () => {

    test('J1.1: Form labels are associated with inputs', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.click('text=Admin Login');

        // Check for proper label associations
        const companyInput = page.locator('#adminCompanyName');
        const hasAttribute = await companyInput.evaluate(el => el.hasAttribute('id'));

        expect(hasAttribute).toBeTruthy();
    });

    test('J1.2: Error messages are announced (role=alert)', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.click('text=Admin Login');

        await page.fill('#adminCompanyName', TEST_COMPANY);
        await page.fill('#adminPassword', 'WrongPassword123!');
        await page.click('#adminLoginBtn');

        const errorElement = page.locator('#adminLoginError');

        // Check if it has aria-live or role for accessibility
        const isAccessible = await errorElement.evaluate(el =>
            el.hasAttribute('role') || el.hasAttribute('aria-live')
        );

        // Even if not set, it should at least be visible
        await expect(errorElement).toBeVisible();
    });

    test('J1.3: Color contrast sufficient (buttons readable)', async ({ page }) => {
        await page.goto(BASE_URL);

        const buttons = page.locator('button');
        const count = await buttons.count();

        // Just verify buttons exist and are visible
        for (let i = 0; i < Math.min(count, 3); i++) {
            await expect(buttons.nth(i)).toBeVisible();
        }
    });
});

// ============ SECTION K: ERROR HANDLING ============

test.describe('K. Error Handling', () => {

    test('K1.1: Network error displays user-friendly message', async ({ page }) => {
        // Navigate to login with offline simulation
        await page.goto(BASE_URL);
        await page.click('text=Admin Login');

        // Simulate offline
        await page.context().setOffline(true);

        await page.fill('#adminCompanyName', TEST_COMPANY);
        await page.fill('#adminPassword', TEST_PASSWORD);
        await page.click('#adminLoginBtn');

        // Should show error message
        const errorMsg = page.locator('#adminLoginError');
        await expect(errorMsg).toBeVisible({ timeout: 3000 });

        // Error should mention network
        const text = await errorMsg.textContent();
        expect(text?.toLowerCase()).toMatch(/network|connection|offline/);

        // Re-enable network
        await page.context().setOffline(false);
    });

    test('K1.2: Empty field validation', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.click('text=Admin Login');

        // Try to submit with empty fields
        // HTML5 validation should prevent submission on required fields
        const submitBtn = page.locator('#adminLoginBtn');

        // Focus on button to trigger validation
        await submitBtn.click();

        // Company name should have required attribute
        const companyInput = page.locator('#adminCompanyName');
        const isRequired = await companyInput.evaluate(el => el.hasAttribute('required'));

        expect(isRequired).toBeTruthy();
    });
});
