// payroll-pay-one.spec.js
// Damiano, 5 October: "how do you record payment to an individual employee". New Pay Run
// used to load everyone with approved hours and offer no way to leave anyone out. Now each
// line has a Pay tick box: untick the others and the run records one person only; the
// unticked hours are not marked paid and come back next time. Harness, no network.
const { test, expect } = require('@playwright/test');
const HARNESS = '/browser-tests/harness-payroll.html';
const TC = (id, wid, date, hrs) => ({ id, workerId: wid, date, projectId: 'p1', status: 'approved', regularHours: hrs, otHours: 0, dtHours: 0 });
const APPROVED = [
    TC('k1', 'w1', '2026-09-16', 8), TC('k2', 'w1', '2026-09-17', 8),       // Kosta 16h at 30 = 480
    TC('j1', 'w2', '2026-09-16', 10),                                        // Jonathan 10h at 28 = 280
    TC('n1', 'w4', '2026-09-18', 4),                                         // Noah 4h at 25 = 100
];
async function openNewRun(page, approved, runs) {
    await page.goto(HARNESS);
    await page.evaluate(([a, r]) => { window.__approved = a; window.__posted = []; return window.load(r || [], [], 'runs'); }, [approved || APPROVED, runs || []]);
    await page.waitForSelector('#payNewRunBtn');
    await page.click('#payNewRunBtn');
    await page.fill('#payFrom', '2026-09-14');
    await page.dispatchEvent('#payFrom', 'change');
    await page.fill('#payTo', '2026-09-20');
    await page.dispatchEvent('#payTo', 'change');
    await page.click('#payLoadBtn');
    await page.waitForSelector('.pay-line');
}

test.describe('Payroll, paying one person on their own', () => {
    test('every line loads ticked, with a note saying how to pay one person', async ({ page }) => {
        await openNewRun(page);
        await expect(page.locator('.pay-line')).toHaveCount(3);
        await expect(page.locator('.pay-line-include:checked')).toHaveCount(3);
        await expect(page.locator('#payPickNote')).toContainText('To pay one person on their own, untick the others');
        await expect(page.locator('#adminContent tfoot')).toContainText('3 of 3 paid');
        await expect(page.locator('#adminContent tfoot')).toContainText('860.00');   // 480 + 280 + 100
    });
    test('unticking two people drops them from the totals and greys their lines', async ({ page }) => {
        await openNewRun(page);
        await page.click('.pay-line[data-wid="w2"] .pay-line-include');
        await page.click('.pay-line[data-wid="w4"] .pay-line-include');
        await expect(page.locator('.pay-line-out')).toHaveCount(2);
        await expect(page.locator('.pay-line[data-wid="w2"]')).toContainText('left out of this run');
        await expect(page.locator('#payPickNote')).toContainText('Paying 1 of 3');
        const foot = await page.locator('#adminContent tfoot').innerText();
        expect(foot).toContain('1 of 3 paid');
        expect(foot).toContain('16.00');
        expect(foot).toContain('480.00');
        expect(foot).not.toContain('860.00');
    });
    test('recording with one person ticked saves a run for that person only, and the others stay unpaid for next time', async ({ page }) => {
        await openNewRun(page);
        await page.click('.pay-line[data-wid="w2"] .pay-line-include');
        await page.click('.pay-line[data-wid="w4"] .pay-line-include');
        await page.fill('#payPaidDate', '2026-09-24');
        await page.dispatchEvent('#payPaidDate', 'change');
        await page.fill('#payRef', 'ET-KOSTA-1');
        await page.dispatchEvent('#payRef', 'input');
        await page.click('#payRecordBtn');
        
        await expect.poll(() => page.evaluate(() => window.__posted.length)).toBe(1);
        const run = await page.evaluate(() => window.__posted[0].body);
        expect(run.lines.length).toBe(1);
        expect(run.lines[0].workerName).toBe('Kosta S');
        expect(run.lines[0].timecardIds).toEqual(['k1', 'k2']);
        expect(run.totals).toMatchObject({ hours: 16, gross: 480, deductions: 0, net: 480, paid: 480, shortfall: 0 });
        expect(run.reference).toBe('ET-KOSTA-1');
        // Start another run for the same period: Kosta is already paid and left out, the other two come back ticked.
        await page.click('#payBackBtn').catch(() => {});
        await page.evaluate(() => { AdminPayroll._view = 'list'; AdminPayroll._draft = null; AdminPayroll._renderContent(); });
        await page.click('#payNewRunBtn');
        await page.fill('#payFrom', '2026-09-14'); await page.dispatchEvent('#payFrom', 'change');
        await page.fill('#payTo', '2026-09-20'); await page.dispatchEvent('#payTo', 'change');
        await page.click('#payLoadBtn');
        await page.waitForSelector('.pay-line');
        const names = await page.locator('.pay-line td:nth-child(2) strong').allTextContents();
        expect(names).toEqual(['Jonathan Brewer', 'Noah Unpaid']);
        await expect(page.locator('.pay-line-include:checked')).toHaveCount(2);
        await expect(page.locator('#adminContent')).toContainText('2 approved timecards already paid in an earlier run, left out');
    });
    test('with nobody ticked, Record refuses and nothing is saved', async ({ page }) => {
        await openNewRun(page);
        for (const w of ['w1', 'w2', 'w4']) await page.click('.pay-line[data-wid="' + w + '"] .pay-line-include');
        await page.fill('#payPaidDate', '2026-09-24');
        await page.dispatchEvent('#payPaidDate', 'change');
        await page.click('#payRecordBtn');
        await expect(page.locator('.toast-error').last()).toContainText('Tick at least one person');
        expect(await page.evaluate(() => window.__posted.length)).toBe(0);
    });
    test('no sideways scroll on a 390 pixel phone with the Pay column added', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        const errors = [];
        page.on('pageerror', e => errors.push(String(e)));
        await openNewRun(page);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);
        expect(errors).toEqual([]);
    });
});
