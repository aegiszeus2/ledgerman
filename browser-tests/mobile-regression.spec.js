// @ts-check
/**
 * mobile-regression.spec.js
 * Ledgerman — Mobile Layout Regression Suite
 *
 * Tests admin dashboard, invoices, contracts, budget tracking,
 * resource groups, worker portal, and AI assistant at 375/390/414px.
 *
 * Checks: horizontal overflow, touch target size, modal fit.
 * Output: screenshots → mobile-screenshots/, report → MOBILE_REGRESSION_REPORT.md
 *
 * Run: npm run test:mobile
 * (or: npx playwright test mobile-regression.spec.js --project=mobile-375 --project=mobile-390 --project=mobile-414)
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.TEST_BASE_URL || 'https://app.ledgerman.org';
const SCREENSHOTS_DIR = path.join(__dirname, 'mobile-screenshots');

// Ensure screenshots dir exists
try { fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true }); } catch (_) {}

// ─── API Mocking ──────────────────────────────────────────────────────────────

async function mockAPIs(page) {
    const emptySync = {
        invoices: [], contracts: [], workers: [], expenses: [],
        timecards: [], budgets: [], resourceGroups: []
    };

    // Sync endpoint — empty data so cache pre-population works
    await page.route('**/api/sync', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(emptySync) })
    );

    // Modules endpoint
    await page.route('**/api/modules', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
    );

    // Abort font CDN requests (non-critical, avoid network dependency)
    await page.route('**/fonts.googleapis.com/**', route => route.abort());
    await page.route('**/fonts.gstatic.com/**', route => route.abort());

    // Catch-all for any remaining API calls
    await page.route('**/api/**', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
    );
}

// ─── Auth Bypass ──────────────────────────────────────────────────────────────

async function injectAdminAuth(page) {
    // Pre-populate localStorage caches with empty arrays so fallback reads don't crash
    await page.evaluate(() => {
        ['ledgeman_invoices', 'ledgeman_contracts', 'ledgeman_workers',
            'ledgeman_expenses', 'ledgeman_timecards', 'ledgeman_budgets',
            'ledgeman_resource_groups'
        ].forEach(k => localStorage.setItem(k, '[]'));
        localStorage.setItem('ledgeman_modules', '{}');
        localStorage.setItem('ledgeman_persistent_login', JSON.stringify({
            companyId: 'test-co',
            token: 'test-jwt',
            name: 'Test Company'
        }));
        sessionStorage.setItem('ledgeman_jwt', 'test-jwt');
        sessionStorage.setItem('ledgeman_companyId', 'test-co');
    });

    // Set App.currentUser and trigger admin panel start
    await page.evaluate(() => {
        if (typeof App === 'undefined') return;
        App.currentUser = {
            type: 'admin',
            name: 'Test Admin',
            companyId: 'test-co',
            token: 'test-jwt'
        };
        if (typeof App.startAdminPanel === 'function') {
            App.startAdminPanel();
        }
    });
}

// ─── Navigation ───────────────────────────────────────────────────────────────

async function navigateAdmin(page, section) {
    await page.evaluate(sec => {
        if (typeof App !== 'undefined' && typeof App.navigate === 'function') {
            App.navigate(sec);
        }
    }, section);
    await page.waitForTimeout(600);
}

// ─── Checks ───────────────────────────────────────────────────────────────────

async function checkOverflow(page) {
    return page.evaluate(() => {
        const sw = document.documentElement.scrollWidth;
        const iw = window.innerWidth;
        const overflowing = [];

        document.querySelectorAll('*').forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.right > iw + 2) {
                overflowing.push({
                    tag: el.tagName,
                    cls: (el.className || '').toString().slice(0, 60),
                    right: Math.round(r.right),
                    iw
                });
            }
        });

        return {
            scrollWidth: sw,
            innerWidth: iw,
            overflow: sw > iw + 1,
            overflowPx: sw - iw,
            overflowing: overflowing.slice(0, 5)
        };
    });
}

async function checkTouchTargets(page) {
    return page.evaluate(() => {
        const MIN = 44;
        const issues = [];
        document.querySelectorAll('button, a, input[type="submit"], input[type="button"], select, [role="button"]').forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.width < 1) return; // hidden/off-screen
            if (r.height > 0 && r.height < MIN) {
                issues.push({
                    tag: el.tagName,
                    text: (el.textContent || '').trim().slice(0, 30),
                    height: Math.round(r.height),
                    cls: (el.className || '').toString().slice(0, 40)
                });
            }
        });
        return issues.slice(0, 8);
    });
}

// ─── Screenshot ───────────────────────────────────────────────────────────────

async function shot(page, name) {
    const safe = name.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    const file = path.join(SCREENSHOTS_DIR, `${safe}.png`);
    await page.screenshot({ path: file, fullPage: false });
    return file;
}

// ─── Admin Page Setup ─────────────────────────────────────────────────────────

async function setupAdmin(page) {
    await mockAPIs(page);
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(600);
    await injectAdminAuth(page);
    await page.waitForTimeout(600);
}

// ─── Helper: viewport label ───────────────────────────────────────────────────

function vwLabel(testInfo) {
    // e.g. project name "mobile-375" → "375"
    return testInfo.project.name.replace('mobile-', '') + 'px';
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test('admin-dashboard', async ({ page }, testInfo) => {
    const vw = vwLabel(testInfo);
    await setupAdmin(page);
    await navigateAdmin(page, 'dashboard');

    const ovf = await checkOverflow(page);
    const touches = await checkTouchTargets(page);
    await shot(page, `dashboard-${vw}`);

    if (touches.length) {
        console.warn(`[WARN] dashboard @${vw}: ${touches.length} elements below 44px touch target`);
        touches.forEach(t => console.warn(`  <${t.tag}> "${t.text}" h=${t.height}px cls="${t.cls}"`));
    }
    if (ovf.overflow) {
        console.error(`[FAIL] dashboard @${vw} overflows by ${ovf.overflowPx}px`);
        ovf.overflowing.forEach(e => console.error(`  <${e.tag} class="${e.cls}"> right=${e.right}px vs innerWidth=${e.iw}px`));
    }

    expect(ovf.overflow, `Dashboard overflows at ${vw} by ${ovf.overflowPx}px`).toBe(false);
});

test('admin-invoices', async ({ page }, testInfo) => {
    const vw = vwLabel(testInfo);
    await setupAdmin(page);
    await navigateAdmin(page, 'invoices');

    const ovf = await checkOverflow(page);
    await shot(page, `invoices-${vw}`);

    // Attempt to open create/new invoice modal
    const createBtn = page.locator('button').filter({ hasText: /new invoice|create|add invoice/i }).first();
    const anyNewBtn = page.locator('button').filter({ hasText: /^new$|^add$/i }).first();
    const btn = (await createBtn.count() > 0) ? createBtn : anyNewBtn;

    if (await btn.count() > 0) {
        await btn.click().catch(() => {});
        await page.waitForTimeout(500);
        const modalOvf = await checkOverflow(page);
        await shot(page, `invoices-modal-${vw}`);
        if (modalOvf.overflow) {
            console.error(`[FAIL] invoice modal @${vw} overflows by ${modalOvf.overflowPx}px`);
        }
        expect(modalOvf.overflow, `Invoice modal overflows at ${vw} by ${modalOvf.overflowPx}px`).toBe(false);
    }

    expect(ovf.overflow, `Invoices list overflows at ${vw} by ${ovf.overflowPx}px`).toBe(false);
});

test('admin-contracts', async ({ page }, testInfo) => {
    const vw = vwLabel(testInfo);
    await setupAdmin(page);
    await navigateAdmin(page, 'contracts');

    const ovf = await checkOverflow(page);
    await shot(page, `contracts-${vw}`);
    expect(ovf.overflow, `Contracts overflows at ${vw} by ${ovf.overflowPx}px`).toBe(false);
});

test('admin-budget-tracking', async ({ page }, testInfo) => {
    const vw = vwLabel(testInfo);
    await setupAdmin(page);
    await navigateAdmin(page, 'budget-tracking');

    const ovf = await checkOverflow(page);
    await shot(page, `budget-tracking-${vw}`);
    expect(ovf.overflow, `Budget tracking overflows at ${vw} by ${ovf.overflowPx}px`).toBe(false);
});

test('admin-resource-groups', async ({ page }, testInfo) => {
    const vw = vwLabel(testInfo);
    await setupAdmin(page);
    await navigateAdmin(page, 'resource-groups');

    const ovf = await checkOverflow(page);
    await shot(page, `resource-groups-${vw}`);
    expect(ovf.overflow, `Resource groups overflows at ${vw} by ${ovf.overflowPx}px`).toBe(false);
});

test('worker-portal', async ({ page }, testInfo) => {
    const vw = vwLabel(testInfo);

    await page.route('**/api/**', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
    );
    await page.route('**/fonts.googleapis.com/**', route => route.abort());
    await page.route('**/fonts.gstatic.com/**', route => route.abort());

    await page.goto(`${BASE_URL}/daily-report.html`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(600);

    const ovf = await checkOverflow(page);
    const touches = await checkTouchTargets(page);
    await shot(page, `worker-portal-${vw}`);

    if (touches.length) {
        console.warn(`[WARN] worker-portal @${vw}: ${touches.length} elements below 44px touch target`);
        touches.forEach(t => console.warn(`  <${t.tag}> "${t.text}" h=${t.height}px`));
    }
    if (ovf.overflow) {
        console.error(`[FAIL] worker-portal @${vw} overflows by ${ovf.overflowPx}px`);
        ovf.overflowing.forEach(e => console.error(`  <${e.tag} class="${e.cls}"> right=${e.right}px`));
    }

    expect(ovf.overflow, `Worker portal overflows at ${vw} by ${ovf.overflowPx}px`).toBe(false);
});

test('ai-assistant', async ({ page }, testInfo) => {
    const vw = vwLabel(testInfo);
    await setupAdmin(page);
    await navigateAdmin(page, 'dashboard');

    // Try to open the AI FAB
    const fab = page.locator('#ai-fab, .ai-fab, [id*="ai-fab"], [class*="ai-fab"]').first();
    if (await fab.count() > 0) {
        await fab.click().catch(() => {});
        await page.waitForTimeout(600);
    }

    const ovf = await checkOverflow(page);
    await shot(page, `ai-assistant-${vw}`);

    if (ovf.overflow) {
        console.error(`[FAIL] ai-assistant @${vw} overflows by ${ovf.overflowPx}px`);
    }

    expect(ovf.overflow, `AI assistant overflows at ${vw} by ${ovf.overflowPx}px`).toBe(false);
});
