// payroll-employees.spec.js
// Damiano, 4 October: a per employee pay history on the Payroll module, everything a
// person has been paid across all runs, hours, gross, deductions, net and when. Harness,
// no network. The run totals stay exactly as they were.
const { test, expect } = require('@playwright/test');
const HARNESS = '/browser-tests/harness-payroll.html';
const LINE = (wid, name, over) => Object.assign({
    workerId: wid, workerName: name, rate: 30, regularHours: 40, otHours: 0, dtHours: 0, hours: 40,
    gross: 1200, deductionTotal: 0, net: 1200, days: [{ date: '2026-09-21', projectName: 'Yard Work 4062', hours: 8 }], timecardIds: ['t1'], deductions: []
}, over || {});
const RUNS = [
    { id: 'r1', periodStart: '2026-09-14', periodEnd: '2026-09-20', paidDate: '2026-09-24', method: 'E-transfer', reference: 'ET-100', status: 'recorded', createdBy: 'Damiano', createdAt: '2026-09-24T18:00:00Z',
      lines: [LINE('w1', 'Kosta S'), LINE('w2', 'Jonathan Brewer', { rate: 28, regularHours: 30, hours: 30, gross: 840, net: 840 })],
      totals: { hours: 70, gross: 2040, deductions: 0, net: 2040 } },
    { id: 'r2', periodStart: '2026-09-21', periodEnd: '2026-09-27', paidDate: '2026-10-01', method: 'Cheque', reference: '2041', status: 'recorded', createdBy: 'Damiano', createdAt: '2026-10-01T18:00:00Z',
      lines: [LINE('w1', 'Kosta S', { regularHours: 35, otHours: 2, hours: 37, gross: 1140, deductionTotal: 150, net: 990, deductions: [{ deductionId: 'd1', description: 'Work boots', type: 'Purchase for employee', amount: 150 }] }),
              LINE('gone1', 'Former Hand', { rate: 25, regularHours: 10, hours: 10, gross: 250, net: 250 })],
      totals: { hours: 47, gross: 1390, deductions: 150, net: 1240 } },
];
const DEDS = [
    { id: 'd1', workerId: 'w1', date: '2026-09-22', amount: 150, recovered: 150, status: 'applied', type: 'Purchase for employee', description: 'Work boots' },
    { id: 'd2', workerId: 'w1', date: '2026-09-30', amount: 80, recovered: 0, status: 'open', type: 'Advance repayment', description: 'Cash advance' },
    { id: 'd3', workerId: 'w4', date: '2026-10-02', amount: 40, recovered: 0, status: 'open', type: 'Other', description: 'Lost tape measure' },
];
async function open(page, tab, runs, deds) {
    await page.goto(HARNESS);
    await page.evaluate(([r, d, t]) => window.load(r, d, t), [runs || RUNS, deds || DEDS, tab || 'employees']);
    await page.waitForSelector('#payrollContent .card');
}

test.describe('Payroll, per employee pay history', () => {
    test('Employees tab lists one line per person across all runs with hours, gross, deductions, net and last paid', async ({ page }) => {
        await open(page);
        await expect(page.locator('.tab-btn[data-tab="employees"]')).toContainText('Employees (3)');
        const rows = page.locator('.pay-emp-row');
        await expect(rows).toHaveCount(3);
        const names = await rows.locator('td:first-child strong').allTextContents();
        expect(names).toEqual(['Former Hand', 'Jonathan Brewer', 'Kosta S']);
        const kosta = page.locator('.pay-emp-row[data-wid="w1"]');
        const cells = await kosta.locator('td').allTextContents();
        expect(cells[1]).toBe('2');                   // runs
        expect(cells[2]).toBe('77.00');               // 40 + 37 hours
        expect(cells[3]).toContain('2,340.00');       // 1200 + 1140 gross
        expect(cells[4]).toContain('-');
        expect(cells[4]).toContain('150.00');         // deductions
        expect(cells[5]).toContain('2,190.00');       // net
        expect(cells[6]).toContain('Oct 1');          // last paid
        await expect(kosta).toContainText('$80.00 still owing');
        const foot = await page.locator('#payrollContent tfoot').innerText();
        expect(foot).toContain('3 employees');
        expect(foot).toContain('117.00');
        expect(foot).toContain('3,430.00');
        expect(foot).toContain('3,280.00');
    });
    test('an employee no longer on the crew still shows, under the name on the run', async ({ page }) => {
        await open(page);
        await expect(page.locator('.pay-emp-row[data-wid="gone1"]')).toContainText('Former Hand');
        const opts = await page.locator('#payEmpSelect option').allTextContents();
        expect(opts).toContain('Former Hand');
        expect(opts).toContain('Noah Unpaid');
    });
    test('View opens the statement: every run the person was on, newest first, with period, paid date, method, hours, rate, gross, deductions, net and totals', async ({ page }) => {
        await open(page);
        await page.click('.pay-emp-row[data-wid="w1"] .pay-emp-open');
        await expect(page.locator('#payEmpStatement')).toContainText('Kosta S, pay history');
        await expect(page.locator('#payEmpStatement')).toContainText('2 pay runs');
        await expect(page.locator('#payEmpStatement')).toContainText('77.00 hours');
        await expect(page.locator('#payEmpStatement')).toContainText('$2,190.00 net paid');
        await expect(page.locator('#payEmpStatement')).toContainText('$80.00 still owing: Cash advance $80.00');
        const entries = page.locator('.pay-emp-entry');
        await expect(entries).toHaveCount(2);
        const first = await entries.nth(0).innerText();
        expect(first).toContain('Sep 21');  expect(first).toContain('Oct 1'); expect(first).toContain('Cheque, 2041');
        expect(first).toContain('37.00');   expect(first).toContain('35 reg + 2 OT');
        expect(first).toContain('1,140.00'); expect(first).toContain('Work boots $150.00'); expect(first).toContain('990.00');
        const second = await entries.nth(1).innerText();
        expect(second).toContain('Sep 14'); expect(second).toContain('E-transfer, ET-100'); expect(second).toContain('1,200.00');
        const foot = await page.locator('#payrollContent tfoot').innerText();
        expect(foot).toContain('77.00'); expect(foot).toContain('2,340.00'); expect(foot).toContain('150.00'); expect(foot).toContain('2,190.00');
        await expect(page.locator('#payEmpSelect')).toHaveValue('w1');
        await expect(page.locator('#payEmpPrintBtn')).toBeVisible();
    });
    test('the dropdown switches people, a person with deductions but no pay says so, and All returns to the summary', async ({ page }) => {
        await open(page);
        await page.selectOption('#payEmpSelect', 'w4');
        await expect(page.locator('#payEmpStatement')).toContainText('Noah Unpaid, pay history');
        await expect(page.locator('#payrollContent')).toContainText('No pay recorded for Noah Unpaid');
        await expect(page.locator('#payEmpStatement')).toContainText('$40.00 still owing: Lost tape measure');
        await page.selectOption('#payEmpSelect', '');
        await expect(page.locator('.pay-emp-row')).toHaveCount(3);
    });
    test('Run on a statement line opens that pay run, and Pay history on a run line comes back to the statement', async ({ page }) => {
        await open(page);
        await page.selectOption('#payEmpSelect', 'w1');
        await page.click('.pay-emp-entry[data-run="r2"] .pay-emp-run');
        await expect(page.locator('h2')).toContainText('Pay Run, Mon, Sep 21 to Sun, Sep 27');
        await page.click('.pay-emp-link[data-wid="gone1"]');
        await expect(page.locator('#payEmpStatement')).toContainText('Former Hand, pay history');
        await expect(page.locator('.pay-emp-entry')).toHaveCount(1);
    });
    test('Pay Runs tab is unchanged: same rows and totals as before', async ({ page }) => {
        await open(page, 'runs');
        const rows = page.locator('#payrollContent tbody tr');
        await expect(rows).toHaveCount(2);
        const top = await rows.nth(0).innerText();
        expect(top).toContain('Kosta S, Former Hand'); expect(top).toContain('47.00'); expect(top).toContain('1,390.00'); expect(top).toContain('1,240.00');
        await expect(page.locator('.tab-btn[data-tab="runs"]')).toContainText('Pay Runs (2)');
    });
    test('no runs yet: Employees tab says nobody has been paid', async ({ page }) => {
        await open(page, 'employees', [], []);
        await expect(page.locator('.tab-btn[data-tab="employees"]')).toContainText('Employees (0)');
        await expect(page.locator('#payrollContent')).toContainText('Nobody has been paid yet');
    });
    test('fits a 390 pixel phone on the summary and the statement', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await open(page);
        let over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(over).toBe(0);
        await page.selectOption('#payEmpSelect', 'w1');
        over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(over).toBe(0);
    });
});
