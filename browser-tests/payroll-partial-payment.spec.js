// payroll-partial-payment.spec.js
// Damiano, 6 October: New Pay Run assumed everyone is paid in full every time. Now each
// line has a Paid now box that starts at the full amount due. Enter less and the gap is a
// shortfall: a reason is required, the run records it, and it is carried into the next run
// the person is on as an unsettled balance tagged with the run it came from and the date
// it has been owed since. Harness, no network.
const { test, expect } = require('@playwright/test');
const HARNESS = '/browser-tests/harness-payroll.html';
const TC = (id, wid, date, hrs) => ({ id, workerId: wid, date, projectId: 'p1', status: 'approved', regularHours: hrs, otHours: 0, dtHours: 0 });
const WEEK1 = [
    TC('k1', 'w1', '2026-09-16', 8), TC('k2', 'w1', '2026-09-17', 8),       // Kosta 16h at 30 = 480
    TC('j1', 'w2', '2026-09-16', 10),                                        // Jonathan 10h at 28 = 280
];
const WEEK2 = [
    TC('k3', 'w1', '2026-09-23', 8),                                         // Kosta 8h at 30 = 240
    TC('j2', 'w2', '2026-09-23', 5),                                         // Jonathan 5h at 28 = 140
];
// A run already recorded for week 1 in which Kosta was paid 300 of 480, short 180.
const RUN1 = {
    id: 'run1', periodStart: '2026-09-14', periodEnd: '2026-09-20', paidDate: '2026-09-24', method: 'E-transfer', reference: 'ET-1', notes: '',
    status: 'recorded', createdBy: 'Damiano', createdAt: '2026-09-24T18:00:00Z',
    lines: [
        { workerId: 'w1', workerName: 'Kosta S', rate: 30, regularHours: 16, otHours: 0, dtHours: 0, hours: 16, gross: 480, deductionTotal: 0, net: 480,
          carriedIn: [], carriedInTotal: 0, due: 480, paid: 300, shortfall: 180, shortReason: 'Short on cash this week, balance next run',
          days: [{ date: '2026-09-16', projectName: 'Yard Work 4062', hours: 8 }, { date: '2026-09-17', projectName: 'Yard Work 4062', hours: 8 }], timecardIds: ['k1', 'k2'], deductions: [] },
        { workerId: 'w2', workerName: 'Jonathan Brewer', rate: 28, regularHours: 10, otHours: 0, dtHours: 0, hours: 10, gross: 280, deductionTotal: 0, net: 280,
          carriedIn: [], carriedInTotal: 0, due: 280, paid: 280, shortfall: 0, shortReason: '',
          days: [{ date: '2026-09-16', projectName: 'Yard Work 4062', hours: 10 }], timecardIds: ['j1'], deductions: [] }
    ],
    totals: { hours: 26, gross: 760, deductions: 0, net: 760, carriedIn: 0, due: 760, paid: 580, shortfall: 180 }
};
async function openNewRun(page, approved, runs, from, to) {
    await page.goto(HARNESS);
    await page.evaluate(([a, r]) => { window.__approved = a; window.__posted = []; return window.load(r || [], [], 'runs'); }, [approved, runs || []]);
    await page.waitForSelector('#payNewRunBtn');
    await page.click('#payNewRunBtn');
    await page.fill('#payFrom', from); await page.dispatchEvent('#payFrom', 'change');
    await page.fill('#payTo', to); await page.dispatchEvent('#payTo', 'change');
    await page.click('#payLoadBtn');
    await page.waitForSelector('.pay-line');
}
async function setPaid(page, wid, value) {
    await page.fill('.pay-line[data-wid="' + wid + '"] .pay-paid', value);
    await page.dispatchEvent('.pay-line[data-wid="' + wid + '"] .pay-paid', 'change');
}

test.describe('Payroll, partial payments carried forward', () => {
    test('Paid now starts at the full amount due and the footer shows no shortfall', async ({ page }) => {
        await openNewRun(page, WEEK1, [], '2026-09-14', '2026-09-20');
        await expect(page.locator('.pay-line[data-wid="w1"] .pay-paid')).toHaveValue('480.00');
        await expect(page.locator('.pay-line[data-wid="w2"] .pay-paid')).toHaveValue('280.00');
        await expect(page.locator('.pay-short')).toHaveCount(0);
        await expect(page.locator('#payShortTotal')).toHaveCount(0);
        await expect(page.locator('#payPickNote')).toContainText('Enter a smaller number to record a partial payment');
    });
    test('entering less than due shows the shortfall, asks for a reason, and the footer carries it', async ({ page }) => {
        await openNewRun(page, WEEK1, [], '2026-09-14', '2026-09-20');
        await setPaid(page, 'w1', '300');
        await expect(page.locator('.pay-line[data-wid="w1"] .pay-short')).toContainText('$180.00 short');
        await expect(page.locator('.pay-line[data-wid="w1"] .pay-short-reason')).toHaveCount(1);
        await expect(page.locator('#payShortTotal')).toContainText('$180.00 unsettled, carried forward');
        const foot = await page.locator('#adminContent tfoot').innerText();
        expect(foot).toContain('760.00');   // due
        expect(foot).toContain('580.00');   // paid
    });
    test('more than due is capped back to the full amount', async ({ page }) => {
        await openNewRun(page, WEEK1, [], '2026-09-14', '2026-09-20');
        await setPaid(page, 'w1', '999');
        await expect(page.locator('.toast-error').last()).toContainText('Capped at the $480.00 due');
        await expect(page.locator('.pay-line[data-wid="w1"] .pay-paid')).toHaveValue('480.00');
        await expect(page.locator('.pay-short')).toHaveCount(0);
    });
    test('Record refuses a partial payment with no reason, and nothing is saved', async ({ page }) => {
        await openNewRun(page, WEEK1, [], '2026-09-14', '2026-09-20');
        await setPaid(page, 'w1', '300');
        await page.fill('#payPaidDate', '2026-09-24'); await page.dispatchEvent('#payPaidDate', 'change');
        await page.click('#payRecordBtn');
        await expect(page.locator('.toast-error').last()).toContainText('Say why Kosta S was not paid in full');
        expect(await page.evaluate(() => window.__posted.length)).toBe(0);
    });
    test('with a reason, the run records paid, shortfall and the reason on the line and in the totals', async ({ page }) => {
        await openNewRun(page, WEEK1, [], '2026-09-14', '2026-09-20');
        await setPaid(page, 'w1', '300');
        await page.fill('.pay-line[data-wid="w1"] .pay-short-reason', 'Short on cash this week, balance next run');
        await page.dispatchEvent('.pay-line[data-wid="w1"] .pay-short-reason', 'input');
        await page.fill('#payPaidDate', '2026-09-24'); await page.dispatchEvent('#payPaidDate', 'change');
        await page.click('#payRecordBtn');
        await expect.poll(() => page.evaluate(() => window.__posted.length)).toBe(1);
        const run = await page.evaluate(() => window.__posted[0].body);
        const kosta = run.lines.find(l => l.workerId === 'w1');
        expect(kosta).toMatchObject({ net: 480, due: 480, paid: 300, shortfall: 180, shortReason: 'Short on cash this week, balance next run', carriedInTotal: 0 });
        expect(run.lines.find(l => l.workerId === 'w2')).toMatchObject({ net: 280, paid: 280, shortfall: 0, shortReason: '' });
        expect(run.totals).toEqual({ hours: 26, gross: 760, deductions: 0, net: 760, carriedIn: 0, due: 760, paid: 580, shortfall: 180 });
        // The detail view that opens after recording says so too.
        await expect(page.locator('.pay-detail-line[data-wid="w1"] .pay-detail-short')).toContainText('$180.00 unsettled, carried to the next run. Reason: Short on cash this week, balance next run');
        await expect(page.locator('#payDetailTotals')).toContainText('Paid $580.00');
        await expect(page.locator('#payDetailTotals')).toContainText('$180.00 unsettled, carried forward');
    });
    test('the next run brings the unsettled balance forward, tagged with the run and the date, and settles it', async ({ page }) => {
        await openNewRun(page, WEEK2, [RUN1], '2026-09-21', '2026-09-27');
        const kosta = page.locator('.pay-line[data-wid="w1"]');
        await expect(kosta.locator('.pay-carried-in')).toContainText('Unsettled balance brought forward: $180.00 from Mon, Sep 14 to Sun, Sep 20, unsettled since Thu, Sep 24 (Short on cash this week, balance next run)');
        await expect(kosta).toContainText('$240.00 this period + $180.00 carried');
        await expect(kosta.locator('.pay-paid')).toHaveValue('420.00');
        // Jonathan was paid in full last time, nothing carried.
        await expect(page.locator('.pay-line[data-wid="w2"] .pay-carried-in')).toHaveCount(0);
        await expect(page.locator('.pay-line[data-wid="w2"] .pay-paid')).toHaveValue('140.00');
        await expect(page.locator('#payPickNote')).toContainText('1 person has an unsettled balance brought forward');
        const foot = await page.locator('#adminContent tfoot').innerText();
        expect(foot).toContain('560.00');            // due: 240 + 180 + 140
        expect(foot).toContain('incl. $180.00 carried');
        await page.fill('#payPaidDate', '2026-10-01'); await page.dispatchEvent('#payPaidDate', 'change');
        await page.click('#payRecordBtn');
        await expect.poll(() => page.evaluate(() => window.__posted.length)).toBe(1);
        const run = await page.evaluate(() => window.__posted[0].body);
        const k = run.lines.find(l => l.workerId === 'w1');
        expect(k.carriedIn).toEqual([{ runId: 'run1', periodStart: '2026-09-14', periodEnd: '2026-09-20', paidDate: '2026-09-24', amount: 180, reason: 'Short on cash this week, balance next run' }]);
        expect(k).toMatchObject({ net: 240, carriedInTotal: 180, due: 420, paid: 420, shortfall: 0 });
        expect(run.totals).toEqual({ hours: 13, gross: 380, deductions: 0, net: 380, carriedIn: 180, due: 560, paid: 560, shortfall: 0 });
        // Once settled it is gone: a third run for the same period offers no balance.
        await page.evaluate(() => { AdminPayroll._view = 'list'; AdminPayroll._draft = null; AdminPayroll._renderContent(); });
        await page.click('#payNewRunBtn');
        await page.fill('#payFrom', '2026-09-28'); await page.dispatchEvent('#payFrom', 'change');
        await page.fill('#payTo', '2026-10-04'); await page.dispatchEvent('#payTo', 'change');
        await page.click('#payLoadBtn');
        await expect(page.locator('#adminContent')).toContainText('No approved hours in this period');
        await expect(page.locator('.pay-carried-in')).toHaveCount(0);
    });
    test('someone owed a balance with no hours this period still gets a line so it can be settled on its own', async ({ page }) => {
        await openNewRun(page, [TC('j2', 'w2', '2026-09-23', 5)], [RUN1], '2026-09-21', '2026-09-27');
        const names = await page.locator('.pay-line td:nth-child(2) strong').allTextContents();
        expect(names).toEqual(['Jonathan Brewer', 'Kosta S']);
        const kosta = page.locator('.pay-line[data-wid="w1"]');
        await expect(kosta).toContainText('No approved hours this period');
        await expect(kosta.locator('.pay-carried-in')).toContainText('$180.00');
        await expect(kosta.locator('.pay-paid')).toHaveValue('180.00');
    });
    test('a balance can be paid down in parts, and the remainder keeps the original run and date', async ({ page }) => {
        await openNewRun(page, WEEK2, [RUN1], '2026-09-21', '2026-09-27');
        await setPaid(page, 'w1', '340');            // 240 this week + 100 of the 180
        await page.fill('.pay-line[data-wid="w1"] .pay-short-reason', 'Paid 100 of the old balance');
        await page.dispatchEvent('.pay-line[data-wid="w1"] .pay-short-reason', 'input');
        await page.fill('#payPaidDate', '2026-10-01'); await page.dispatchEvent('#payPaidDate', 'change');
        await page.click('#payRecordBtn');
        await expect.poll(() => page.evaluate(() => window.__posted.length)).toBe(1);
        const run = await page.evaluate(() => window.__posted[0].body);
        expect(run.lines.find(l => l.workerId === 'w1')).toMatchObject({ due: 420, paid: 340, shortfall: 80 });
        // Employees tab: Kosta's net due, paid and the 80 still unsettled, dated from this run.
        await page.evaluate(() => { AdminPayroll._view = 'list'; AdminPayroll._tab = 'employees'; AdminPayroll._empId = ''; AdminPayroll._renderContent(); });
        const row = page.locator('.pay-emp-row[data-wid="w1"]');
        await expect(row).toContainText('$720.00');   // net due 480 + 240
        await expect(row).toContainText('$640.00');   // paid 300 + 340
        await expect(row.locator('.pay-emp-unsettled')).toContainText('$80.00 unsettled, owed to them since Thu, Oct 1');
        await expect(page.locator('#payrollContent tfoot')).toContainText('$80.00 unsettled in total');
        await page.click('.pay-emp-row[data-wid="w1"] .pay-emp-open');
        await expect(page.locator('#payEmpStatement')).toContainText('$720.00 net due, $640.00 paid');
        await expect(page.locator('#payEmpStatement .pay-emp-unsettled')).toContainText('$80.00 unsettled, owed to Kosta S');
        await expect(page.locator('.pay-emp-entry').first().locator('.pay-emp-short')).toContainText('$80.00 unsettled: Paid 100 of the old balance');
    });
    test('runs recorded before partial payments existed still read as paid in full', async ({ page }) => {
        const old = { id: 'old1', periodStart: '2026-09-07', periodEnd: '2026-09-13', paidDate: '2026-09-17', method: 'Cash', status: 'recorded',
            lines: [{ workerId: 'w2', workerName: 'Jonathan Brewer', rate: 28, regularHours: 10, otHours: 0, dtHours: 0, hours: 10, gross: 280, deductionTotal: 0, net: 280, days: [], timecardIds: ['old-j'], deductions: [] }],
            totals: { hours: 10, gross: 280, deductions: 0, net: 280 } };
        await page.goto(HARNESS);
        await page.evaluate(([r]) => window.load(r, [], 'runs'), [[old]]);
        await page.waitForSelector('.pay-run-row');
        await expect(page.locator('.pay-run-row')).toContainText('$280.00');
        await expect(page.locator('.pay-run-short')).toHaveCount(0);
        await page.evaluate(() => { AdminPayroll._tab = 'employees'; AdminPayroll._renderContent(); });
        await expect(page.locator('.pay-emp-row[data-wid="w2"]')).toContainText('$280.00');
        await expect(page.locator('.pay-emp-unsettled')).toHaveCount(0);
        await page.evaluate(() => { AdminPayroll._tab = 'runs'; AdminPayroll._renderContent(); });
        await page.click('#payNewRunBtn');
        await page.fill('#payFrom', '2026-09-14'); await page.dispatchEvent('#payFrom', 'change');
        await page.fill('#payTo', '2026-09-20'); await page.dispatchEvent('#payTo', 'change');
        await page.evaluate(() => { window.__approved = []; });
        await page.click('#payLoadBtn');
        await expect(page.locator('#adminContent')).toContainText('No approved hours in this period');
    });
    test('a run whose balance a later run carried in cannot be deleted first', async ({ page }) => {
        const run2 = { id: 'run2', periodStart: '2026-09-21', periodEnd: '2026-09-27', paidDate: '2026-10-01', method: 'E-transfer', status: 'recorded',
            lines: [{ workerId: 'w1', workerName: 'Kosta S', rate: 30, regularHours: 8, otHours: 0, dtHours: 0, hours: 8, gross: 240, deductionTotal: 0, net: 240,
                carriedIn: [{ runId: 'run1', periodStart: '2026-09-14', periodEnd: '2026-09-20', paidDate: '2026-09-24', amount: 180, reason: '' }], carriedInTotal: 180, due: 420, paid: 420, shortfall: 0, shortReason: '',
                days: [], timecardIds: ['k3'], deductions: [] }],
            totals: { hours: 8, gross: 240, deductions: 0, net: 240, carriedIn: 180, due: 420, paid: 420, shortfall: 0 } };
        await page.goto(HARNESS);
        await page.evaluate(([r]) => window.load(r, [], 'runs'), [[RUN1, run2]]);
        await page.waitForSelector('.pay-run-row');
        await page.click('.pay-run-row[data-id="run1"] .pay-view-btn');
        await page.click('#payDeleteBtn');
        await expect(page.locator('.toast-error').last()).toContainText('carried into the run of Mon, Sep 21 to Sun, Sep 27. Delete that one first');
        expect(await page.evaluate(() => window.__runs.length)).toBe(2);
    });
    test('no sideways scroll on a 390 pixel phone with the Paid now column and a shortfall open', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        const errors = [];
        page.on('pageerror', e => errors.push(String(e)));
        await openNewRun(page, WEEK2, [RUN1], '2026-09-21', '2026-09-27');
        await setPaid(page, 'w1', '300');
        await expect(page.locator('.pay-short')).toHaveCount(1);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);
        expect(errors).toEqual([]);
    });
});
