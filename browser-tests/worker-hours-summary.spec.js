// worker-hours-summary.spec.js
// The weekly hours dashboard on the worker History screen: totals, week
// grouping, and a period selector. Also checks the numbers agree with the
// entries listed underneath them, since a summary that disagrees with the list
// is worse than no summary at all.
const { test, expect } = require('@playwright/test');

const HARNESS = '/browser-tests/harness.html';

function ymd(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
           '-' + String(d.getDate()).padStart(2, '0');
}
// Monday of the current week — the same convention the module uses.
function mondayOfThisWeek() {
    const d = new Date();
    const dow = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dow);
    d.setHours(0, 0, 0, 0);
    return d;
}
function plusDays(d, n) {
    const x = new Date(d.getTime());
    x.setDate(x.getDate() + n);
    return x;
}

function sub(date, hours, status, extra) {
    return Object.assign({
        id: 's' + date + hours, workerId: 'w1', projectId: 'proj-1',
        date: date, hours: hours, status: status,
        description: 'work', submittedAt: date + 'T18:00:00.000Z'
    }, extra || {});
}

async function loadHistory(page, submissions) {
    await page.goto(HARNESS);
    await page.evaluate(s => { window.__submissions = s; }, submissions);
    await page.evaluate(() => window.renderHistory());
    await page.waitForSelector('#histPeriod');
}

test.describe('worker weekly hours summary', () => {

    test('summary panel and period selector render', async ({ page }) => {
        const mon = mondayOfThisWeek();
        await loadHistory(page, [sub(ymd(mon), 8, 'Approved')]);

        await expect(page.locator('#histPeriod')).toBeVisible();
        await expect(page.locator('.worker-summary .stat-card')).toHaveCount(4);
        await expect(page.locator('.worker-summary')).toContainText('Total hours');
        await expect(page.locator('.worker-summary')).toContainText('Days worked');
        await expect(page.locator('.worker-summary')).toContainText('Approved');
        await expect(page.locator('.worker-summary')).toContainText('Awaiting approval');
    });

    test('totals add up for the current week', async ({ page }) => {
        const mon = mondayOfThisWeek();
        await loadHistory(page, [
            sub(ymd(mon), 8, 'Approved'),
            sub(ymd(plusDays(mon, 1)), 7.5, 'Approved'),
            sub(ymd(plusDays(mon, 2)), 6, 'Pending')
        ]);

        const values = await page.locator('.worker-summary .stat-value').allTextContents();
        expect(values[0]).toBe('21.5');   // total
        expect(values[1]).toBe('3');      // days worked
        expect(values[2]).toBe('15.5');   // approved
        expect(values[3]).toBe('6');      // pending
    });

    test('rejected entries are excluded from hours worked', async ({ page }) => {
        const mon = mondayOfThisWeek();
        await loadHistory(page, [
            sub(ymd(mon), 8, 'Approved'),
            sub(ymd(plusDays(mon, 1)), 9, 'Rejected')
        ]);

        const values = await page.locator('.worker-summary .stat-value').allTextContents();
        expect(values[0]).toBe('8');
        expect(values[1]).toBe('1');
    });

    test('hours are derived from the time range when not stored', async ({ page }) => {
        const mon = mondayOfThisWeek();
        await loadHistory(page, [
            sub(ymd(mon), 0, 'Pending', { startTime: '07:00', endTime: '15:30' })
        ]);
        const values = await page.locator('.worker-summary .stat-value').allTextContents();
        expect(values[0]).toBe('8.5');
    });

    test('last week is a different total from this week', async ({ page }) => {
        const mon = mondayOfThisWeek();
        const lastMon = plusDays(mon, -7);
        await loadHistory(page, [
            sub(ymd(mon), 8, 'Approved'),
            sub(ymd(lastMon), 40, 'Approved')
        ]);

        let values = await page.locator('.worker-summary .stat-value').allTextContents();
        expect(values[0]).toBe('8');

        await page.selectOption('#histPeriod', 'lastWeek');
        await page.waitForTimeout(200);
        values = await page.locator('.worker-summary .stat-value').allTextContents();
        expect(values[0]).toBe('40');

        await page.selectOption('#histPeriod', 'last2Weeks');
        await page.waitForTimeout(200);
        values = await page.locator('.worker-summary .stat-value').allTextContents();
        expect(values[0]).toBe('48');
    });

    test('the period selection survives a status-tab click', async ({ page }) => {
        const mon = mondayOfThisWeek();
        await loadHistory(page, [
            sub(ymd(mon), 8, 'Approved'),
            sub(ymd(plusDays(mon, -7)), 40, 'Approved')
        ]);

        await page.selectOption('#histPeriod', 'lastWeek');
        await page.waitForTimeout(200);
        await page.locator('.tab-btn', { hasText: 'Approved' }).click();
        await page.waitForTimeout(200);

        expect(await page.locator('#histPeriod').inputValue()).toBe('lastWeek');
        const values = await page.locator('.worker-summary .stat-value').allTextContents();
        expect(values[0]).toBe('40');
    });

    test('hours are grouped by week, newest first', async ({ page }) => {
        const mon = mondayOfThisWeek();
        await loadHistory(page, [
            sub(ymd(mon), 8, 'Approved'),
            sub(ymd(plusDays(mon, -7)), 40, 'Approved')
        ]);
        await page.selectOption('#histPeriod', 'last2Weeks');
        await page.waitForTimeout(200);

        const rows = await page.locator('.card:has-text("Week of") >> text=/Week of/').allTextContents();
        expect(rows.length).toBe(2);
        const body = await page.locator('.card:has-text("Week of")').innerText();
        expect(body.indexOf('8 hrs')).toBeGreaterThan(-1);
        expect(body.indexOf('40 hrs')).toBeGreaterThan(-1);
        // Newest week appears above the older one.
        expect(body.indexOf('8 hrs')).toBeLessThan(body.indexOf('40 hrs'));
    });

    test('a period with no work reads clearly instead of blank', async ({ page }) => {
        await loadHistory(page, [sub(ymd(mondayOfThisWeek()), 8, 'Approved')]);
        await page.selectOption('#histPeriod', 'lastMonth');
        await page.waitForTimeout(200);
        await expect(page.locator('body')).toContainText('No hours recorded in this period');
    });

    test('a date is not pushed into the wrong week by timezone', async ({ page }) => {
        // A Monday parsed as UTC lands on the previous Sunday west of Greenwich,
        // which would move the whole day into the previous week.
        const mon = mondayOfThisWeek();
        await loadHistory(page, [sub(ymd(mon), 8, 'Approved')]);
        const values = await page.locator('.worker-summary .stat-value').allTextContents();
        expect(values[0]).toBe('8'); // counted in THIS week
    });

    test('no console errors on the history screen', async ({ page }) => {
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await loadHistory(page, [sub(ymd(mondayOfThisWeek()), 8, 'Approved')]);
        await page.selectOption('#histPeriod', 'thisMonth');
        await page.waitForTimeout(200);
        expect(errors).toEqual([]);
    });
});

test.describe('worker hours summary — mobile', () => {
    test.use({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });

    test('no horizontal overflow and touch-sized controls at 375px', async ({ page }) => {
        const mon = mondayOfThisWeek();
        await loadHistory(page, [
            sub(ymd(mon), 8, 'Approved'),
            sub(ymd(plusDays(mon, 1)), 7.5, 'Pending')
        ]);

        const overflow = await page.evaluate(() =>
            document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);

        // The period selector must clear the 44px touch floor and the 16px
        // font floor that stops iOS zooming the page on tap.
        const box = await page.locator('#histPeriod').boundingBox();
        expect(box.height).toBeGreaterThanOrEqual(44);
        const fontSize = await page.evaluate(() =>
            parseFloat(getComputedStyle(document.getElementById('histPeriod')).fontSize));
        expect(fontSize).toBeGreaterThanOrEqual(16);
    });
});
