// approvals-list.spec.js
// Damiano, 3 October, on Time Approvals: (1) History laid out the same way as Pending,
// (2) a sort newest/oldest next to the employee and date filter, (3) the day of the week
// on every date. Runs against harness-approvals.html (stub data, no network).
const { test, expect } = require('@playwright/test');

const HARNESS = '/browser-tests/harness-approvals.html';

const SUB = (id, over) => Object.assign({
    id: id, workerId: 'w1', projectId: 'p1', date: '2026-10-02', status: 'Pending', rateType: 'Hourly',
    hours: 8, rate: 0, startTime: '07:00', endTime: '15:30', description: 'desc ' + id,
    entryMethod: 'Manual Entry', createdAt: '2026-10-02T20:00:00Z',
}, over || {});

const DATA = [
    SUB('pOld', { date: '2026-09-28', description: 'oldest pending' }),
    SUB('pNew', { date: '2026-10-02', description: 'newest pending' }),
    SUB('pMid', { date: '2026-09-30', workerId: 'w2', projectId: 'p2', description: 'middle pending' }),
    SUB('hApr', { date: '2026-09-21', status: 'Approved', reviewedBy: 'Damiano', reviewedAt: '2026-09-22T14:05:00Z', description: 'approved card', entryMethod: 'Clock In/Out' }),
    SUB('hRej', { date: '2026-09-25', status: 'Rejected', reviewedBy: 'Damiano', reviewedAt: '2026-09-26T09:00:00Z', rejectionReason: 'wrong job', description: 'rejected card' }),
    SUB('hApr2', { date: '2026-09-23', status: 'Approved', workerId: 'w2', projectId: 'p2', reviewedBy: 'Lucas', reviewedAt: '2026-09-24T14:05:00Z', description: 'second approved', rate: 28 }),
];
const TCS = [
    { id: 'tc1', workerId: 'w2', projectId: 'p2', date: '2026-09-29', regularHours: 7, status: 'pending', notes: 'standalone old' },
    { id: 'tc2', workerId: 'w2', projectId: 'p2', date: '2026-10-01', regularHours: 6, status: 'pending', notes: 'standalone new' },
];

async function open(page, subs, tcs) {
    await page.goto(HARNESS);
    await page.evaluate(([s, t]) => window.load(s, t), [subs || DATA, tcs || TCS]);
    await page.waitForSelector('#approvalContent .card');
}
const tab = async (page, name) => { await page.click('.tab-btn[data-tab="' + name + '"]'); await page.waitForSelector('#approvalContent .card'); };
const cardIds = (page) => page.$$eval('#approvalContent .card[data-sub-id]', els => els.map(e => e.getAttribute('data-sub-id')));
const cardDates = (page) => page.$$eval('#approvalContent .card[data-sub-id] .appr-date', els => els.map(e => e.textContent.trim()));
const tcIds = (page) => page.$$eval('#approvalContent .card[data-tc-id]', els => els.map(e => e.getAttribute('data-tc-id')));

test.describe('Time Approvals list', () => {

    test('History is cards like Pending, no table, with status, reviewer and reason', async ({ page }) => {
        await open(page);
        await tab(page, 'history');
        expect(await page.$('#approvalContent table')).toBeNull();
        const ids = await cardIds(page);
        expect(ids.sort()).toEqual(['hApr', 'hApr2', 'hRej']);
        const apr = page.locator('.card[data-sub-id="hApr"]');
        await expect(apr.locator('.appr-status')).toHaveText('Approved');
        await expect(apr.locator('strong').first()).toHaveText('Kosta S');
        await expect(apr).toContainText('Yard Work 4062');
        await expect(apr).toContainText('Clock in:');
        await expect(apr).toContainText('07:00');
        await expect(apr).toContainText('approved card');
        await expect(apr).toContainText('8 hrs @ $30.00/hr = $240.00');   // falls back to the worker rate, like Pending
        await expect(apr).toContainText('Clock In/Out');
        await expect(apr.locator('.appr-reviewed')).toContainText('Approved by Damiano on');
        await expect(apr.locator('.unapprove-btn')).toHaveCount(1);
        await expect(apr.locator('.edit-sub-btn')).toHaveCount(1);
        await expect(apr.locator('.approve-btn')).toHaveCount(0);
        const rej = page.locator('.card[data-sub-id="hRej"]');
        await expect(rej.locator('.appr-status')).toHaveText('Rejected');
        await expect(rej.locator('.appr-reason')).toContainText('wrong job');
        await expect(rej.locator('.unapprove-btn')).toHaveCount(0);
        await expect(rej.locator('.edit-sub-btn')).toHaveCount(1);
        // same structural pieces as a pending card
        await tab(page, 'pending');
        const pendingKeys = await page.$eval('.card[data-sub-id="pNew"]', el => ['.appr-date', '.photo-thumbs', 'strong'].map(s => !!el.querySelector(s)));
        await tab(page, 'history');
        const histKeys = await page.$eval('.card[data-sub-id="hApr"]', el => ['.appr-date', '.photo-thumbs', 'strong'].map(s => !!el.querySelector(s)));
        expect(histKeys).toEqual(pendingKeys);
    });

    test('every date carries the day of the week, on both tabs and on standalone timecards', async ({ page }) => {
        await open(page);
        const pend = await cardDates(page);
        expect(pend).toEqual(['Friday, Oct 2, 2026', 'Wednesday, Sep 30, 2026', 'Monday, Sep 28, 2026']);
        const tcText = await page.$$eval('#approvalContent .card[data-tc-id]', els => els.map(e => e.textContent));
        expect(tcText[0]).toContain('Thursday, Oct 1, 2026');
        expect(tcText[1]).toContain('Tuesday, Sep 29, 2026');
        await tab(page, 'history');
        expect(await cardDates(page)).toEqual(['Friday, Sep 25, 2026', 'Wednesday, Sep 23, 2026', 'Monday, Sep 21, 2026']);
    });

    test('Sort menu sits in the filter bar, defaults to newest first, and flips both tabs and the timecards', async ({ page }) => {
        await open(page);
        const sort = page.locator('#approvalsFilterBar #apprFilterSort');
        await expect(sort).toBeVisible();
        expect(await sort.inputValue()).toBe('desc');
        expect(await sort.locator('option').allTextContents()).toEqual(['Newest first', 'Oldest first']);
        expect(await cardIds(page)).toEqual(['pNew', 'pMid', 'pOld']);
        expect(await tcIds(page)).toEqual(['tc2', 'tc1']);
        await sort.selectOption('asc');
        await page.waitForSelector('#approvalContent .card');
        expect(await cardIds(page)).toEqual(['pOld', 'pMid', 'pNew']);
        expect(await tcIds(page)).toEqual(['tc1', 'tc2']);
        await tab(page, 'history');
        expect(await page.inputValue('#apprFilterSort')).toBe('asc');
        expect(await cardIds(page)).toEqual(['hApr', 'hApr2', 'hRej']);
        await page.selectOption('#apprFilterSort', 'desc');
        await page.waitForSelector('#approvalContent .card');
        expect(await cardIds(page)).toEqual(['hRej', 'hApr2', 'hApr']);
    });

    test('same day orders by clock in time, and sort survives Clear while the employee filter does not', async ({ page }) => {
        const subs = [
            SUB('a', { date: '2026-10-01', startTime: '13:00', endTime: '17:00' }),
            SUB('b', { date: '2026-10-01', startTime: '07:00', endTime: '12:00' }),
            SUB('c', { date: '2026-10-01', workerId: 'w2', startTime: '09:00', endTime: '10:00' }),
        ];
        await open(page, subs, []);
        expect(await cardIds(page)).toEqual(['a', 'c', 'b']);
        await page.selectOption('#apprFilterSort', 'asc');
        await page.waitForSelector('#approvalContent .card');
        expect(await cardIds(page)).toEqual(['b', 'c', 'a']);
        await page.selectOption('#apprFilterWorker', 'w2');
        await page.waitForSelector('#approvalContent .card');
        expect(await cardIds(page)).toEqual(['c']);
        expect(await page.inputValue('#apprFilterSort')).toBe('asc');
        await page.click('#apprFilterClear');
        await page.waitForSelector('#approvalContent .card');
        expect(await cardIds(page)).toEqual(['b', 'c', 'a']);
        expect(await page.inputValue('#apprFilterSort')).toBe('asc');
        expect(await page.inputValue('#apprFilterWorker')).toBe('');
    });

    test('empty history still shows the empty state', async ({ page }) => {
        await open(page, [SUB('p1only')], []);
        await page.click('.tab-btn[data-tab="history"]');
        await expect(page.locator('#approvalContent .empty h3')).toHaveText('No History');
    });

    test('history cards fit a 375 pixel phone with no sideways scroll', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await open(page);
        await tab(page, 'history');
        const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(over).toBeLessThanOrEqual(0);
        await expect(page.locator('.card[data-sub-id="hApr"] .unapprove-btn')).toBeVisible();
    });
});
