// approvals-crew-legend.spec.js
// Damiano, 3 October, on Time Approvals: (1) the crew a supervisor ticked as on site shows
// on each card on both tabs, (2) a legend explains the colour coding. Harness, no network.
const { test, expect } = require('@playwright/test');
const HARNESS = '/browser-tests/harness-approvals.html';
const SUB = (id, over) => Object.assign({
    id: id, workerId: 'w1', projectId: 'p1', date: '2026-10-02', status: 'Pending', rateType: 'Hourly',
    hours: 8, rate: 0, startTime: '07:00', endTime: '15:30', description: 'desc ' + id,
    entryMethod: 'Manual Entry', createdAt: '2026-10-02T20:00:00Z',
}, over || {});
const DATA = [
    SUB('crewP', { employeesPresent: ['w1', 'w2', 'w3', 'gone1', 'w2'] }),
    SUB('soloP', { date: '2026-10-01', employeesPresent: ['w1'] }),
    SUB('noneP', { date: '2026-09-30' }),
    SUB('crewH', { date: '2026-09-21', status: 'Approved', reviewedBy: 'Damiano', reviewedAt: '2026-09-22T14:05:00Z', employeesPresent: [{ id: 'w2', name: 'Jonathan Brewer' }, 'w3'] }),
];
const TCS = [{ id: 'tc1', workerId: 'w2', projectId: 'p2', date: '2026-09-29', regularHours: 7, status: 'pending', notes: 'standalone' }];
async function open(page, subs, tcs) {
    await page.goto(HARNESS);
    await page.evaluate(() => { window.__workers.push({ id: 'w3', name: 'Matthew Parker', defaultRate: 30 }); });
    await page.evaluate(([s, t]) => window.load(s, t), [subs || DATA, tcs || TCS]);
    await page.waitForSelector('#approvalContent .card');
}
const tab = async (page, name) => { await page.click('.tab-btn[data-tab="' + name + '"]'); await page.waitForSelector('#approvalContent .card'); };

test.describe('Time Approvals crew and legend', () => {
    test('crew ticked by the supervisor shows on the pending card, self left out, names sorted, no repeats, unknown named', async ({ page }) => {
        await open(page);
        const crew = page.locator('.card[data-sub-id="crewP"] .appr-crew');
        await expect(crew).toHaveCount(1);
        await expect(crew).toContainText('On site with Kosta:');
        const names = await crew.locator('.appr-crew-name').allTextContents();
        expect(names).toEqual(['Jonathan Brewer', 'Matthew Parker', 'a worker no longer on the crew']);
        await expect(crew).not.toContainText('Kosta S');
    });
    test('only self ticked reads as alone, and a card with no crew carries no line', async ({ page }) => {
        await open(page);
        await expect(page.locator('.card[data-sub-id="soloP"] .appr-crew')).toContainText('Kosta only, no one else selected');
        await expect(page.locator('.card[data-sub-id="noneP"] .appr-crew')).toHaveCount(0);
        await expect(page.locator('.card[data-tc-id="tc1"] .appr-crew')).toHaveCount(0);
    });
    test('crew shows on the History tab too, accepting {id,name} objects', async ({ page }) => {
        await open(page);
        await tab(page, 'history');
        const names = await page.locator('.card[data-sub-id="crewH"] .appr-crew .appr-crew-name').allTextContents();
        expect(names).toEqual(['Jonathan Brewer', 'Matthew Parker']);
    });
    test('legend sits under the filter bar, collapsed, opens on tap, lists every colour, and survives a tab change', async ({ page }) => {
        await open(page);
        const legend = page.locator('#approvalsLegend');
        await expect(legend).toHaveCount(1);
        await expect(page.locator('#approvalsLegendBody')).toBeHidden();
        await expect(page.locator('#approvalsLegendToggle')).toContainText('Legend');
        await page.click('#approvalsLegendToggle');
        await expect(page.locator('#approvalsLegendBody')).toBeVisible();
        const rows = await page.locator('.appr-legend-row').allTextContents();
        expect(rows.length).toBe(11);
        const txt = rows.join(' ');
        for (const k of ['Amber edge', 'Red edge on a pending', 'Green edge and badge', 'Red edge and badge', 'Blue edge and chip', 'Overlapping entry', 'Edited badge', 'Impact badge', 'Entry method', 'On site with', 'Gold number']) expect(txt).toContain(k);
        // the filter bar precedes it, the list follows it
        const order = await page.$$eval('#approvalsFilterBar, #approvalsLegend, #approvalContent', els => els.map(e => e.id));
        expect(order).toEqual(['approvalsFilterBar', 'approvalsLegend', 'approvalContent']);
        await tab(page, 'history');
        await expect(page.locator('#approvalsLegendBody')).toBeVisible();   // stays open across a re-render
        await page.click('#approvalsLegendToggle');
        await expect(page.locator('#approvalsLegendBody')).toBeHidden();
    });
    test('standalone timecard edge is the same blue as its chip', async ({ page }) => {
        await open(page);
        const edge = await page.$eval('.card[data-tc-id="tc1"]', el => getComputedStyle(el).borderLeftColor);
        expect(edge).toBe('rgb(52, 152, 219)');
    });
    test('fits a 390 pixel phone with the legend open', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await open(page);
        await page.click('#approvalsLegendToggle');
        const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(over).toBe(0);
    });
});
