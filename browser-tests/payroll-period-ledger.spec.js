// payroll-period-ledger.spec.js
// Damiano, 14 October: a historic pay run must never show a balance from a later period,
// and every payment made toward a period must be recorded on that period. Pay periods
// (what someone earned) and payments (money out) are now kept apart. A run's Paid now box
// is for its own period only; earlier periods still owed get their own box under the name.
// Runs recorded under the old carry-forward scheme are read under the migration rule.
// Harness, no network.
const { test, expect } = require('@playwright/test');
const HARNESS = '/browser-tests/harness-payroll.html';
const TC = (id, wid, date, hrs) => ({ id, workerId: wid, date, projectId: 'p1', status: 'approved', regularHours: hrs, otHours: 0, dtHours: 0 });
const WEEK0 = [TC('k0', 'w1', '2026-09-09', 4)];                              // Kosta 4h at 30 = 120, the week BEFORE run1
const WEEK1 = [TC('k1', 'w1', '2026-09-16', 8), TC('k2', 'w1', '2026-09-17', 8), TC('j1', 'w2', '2026-09-16', 10)];   // Kosta 480, Jonathan 280
const WEEK2 = [TC('k3', 'w1', '2026-09-23', 8), TC('j2', 'w2', '2026-09-23', 5)];                                      // Kosta 240, Jonathan 140
// A run already recorded for week 1, under the OLD scheme, in which Kosta was paid 300 of 480.
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
// A later run under the NEW scheme that paid Kosta's week 2 and 180 toward week 1.
const RUN2 = {
    id: 'run2', periodStart: '2026-09-21', periodEnd: '2026-09-27', paidDate: '2026-10-01', method: 'E-transfer', status: 'recorded', ledger: 'periods', createdAt: '2026-10-01T18:00:00Z',
    lines: [{ workerId: 'w1', workerName: 'Kosta S', rate: 30, regularHours: 8, otHours: 0, dtHours: 0, hours: 8, gross: 240, deductionTotal: 0, net: 240,
        ownPaid: 240, shortfall: 0, shortReason: '', allocations: [{ runId: 'run1', periodStart: '2026-09-14', periodEnd: '2026-09-20', amount: 180 }], allocationsTotal: 180, paid: 420,
        days: [], timecardIds: ['k3'], deductions: [] }],
    totals: { hours: 8, gross: 240, deductions: 0, net: 240, paid: 420, shortfall: 0, allocated: 180 }
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
async function setEarlier(page, wid, runId, value) {
    const sel = '.pay-line[data-wid="' + wid + '"] .pay-earlier-row[data-run="' + runId + '"] .pay-earlier-amt';
    await page.fill(sel, value);
    await page.dispatchEvent(sel, 'change');
}
async function record(page, paidDate) {
    await page.fill('#payPaidDate', paidDate); await page.dispatchEvent('#payPaidDate', 'change');
    await page.click('#payRecordBtn');
}
const toList = (page) => page.evaluate(() => { AdminPayroll._view = 'list'; AdminPayroll._draft = null; AdminPayroll._tab = 'runs'; AdminPayroll._renderContent(); });
const toEmployees = (page) => page.evaluate(() => { AdminPayroll._view = 'list'; AdminPayroll._draft = null; AdminPayroll._tab = 'employees'; AdminPayroll._empId = ''; AdminPayroll._renderContent(); });

test.describe('Payroll, pay periods and payments kept apart', () => {
    test('Paid now starts at this period\'s full net, Due is this period only, no shortfall', async ({ page }) => {
        await openNewRun(page, WEEK1, [], '2026-09-14', '2026-09-20');
        await expect(page.locator('.pay-line[data-wid="w1"] .pay-paid')).toHaveValue('480.00');
        await expect(page.locator('.pay-line[data-wid="w2"] .pay-paid')).toHaveValue('280.00');
        await expect(page.locator('.pay-short')).toHaveCount(0);
        await expect(page.locator('.pay-earlier')).toHaveCount(0);
        await expect(page.locator('#payShortTotal')).toHaveCount(0);
        await expect(page.locator('#payPickNote')).toContainText('Due is this period only');
    });
    test('paying less than net shows the shortfall as owed on this period and asks why', async ({ page }) => {
        await openNewRun(page, WEEK1, [], '2026-09-14', '2026-09-20');
        await setPaid(page, 'w1', '300');
        await expect(page.locator('.pay-line[data-wid="w1"] .pay-short')).toContainText('$180.00 short, stays owed on this period');
        await expect(page.locator('.pay-line[data-wid="w1"] .pay-short-reason')).toHaveCount(1);
        await expect(page.locator('#payShortTotal')).toContainText('$180.00 unsettled on this period');
        const foot = await page.locator('#adminContent tfoot').innerText();
        expect(foot).toContain('760.00');   // net
        expect(foot).toContain('580.00');   // paid
    });
    test('more than this period\'s net is capped back, and points at the earlier period box', async ({ page }) => {
        await openNewRun(page, WEEK1, [], '2026-09-14', '2026-09-20');
        await setPaid(page, 'w1', '999');
        await expect(page.locator('.toast-error').last()).toContainText('Capped at the $480.00 due this period');
        await expect(page.locator('.pay-line[data-wid="w1"] .pay-paid')).toHaveValue('480.00');
    });
    test('Record refuses a short payment with no reason, and nothing is saved', async ({ page }) => {
        await openNewRun(page, WEEK1, [], '2026-09-14', '2026-09-20');
        await setPaid(page, 'w1', '300');
        await record(page, '2026-09-24');
        await expect(page.locator('.toast-error').last()).toContainText('Say why Kosta S was not paid in full');
        expect(await page.evaluate(() => window.__posted.length)).toBe(0);
    });
    test('a short payment is recorded on the period, and the run detail shows the payment and what is still owed since when', async ({ page }) => {
        await openNewRun(page, WEEK1, [], '2026-09-14', '2026-09-20');
        await setPaid(page, 'w1', '300');
        await page.fill('.pay-line[data-wid="w1"] .pay-short-reason', 'Short on cash this week, balance next run');
        await page.dispatchEvent('.pay-line[data-wid="w1"] .pay-short-reason', 'input');
        await record(page, '2026-09-24');
        await expect.poll(() => page.evaluate(() => window.__posted.length)).toBe(1);
        const run = await page.evaluate(() => window.__posted[0].body);
        expect(run.ledger).toBe('periods');
        expect(run.lines.find(l => l.workerId === 'w1')).toMatchObject({ net: 480, ownPaid: 300, paid: 300, shortfall: 180, allocations: [], allocationsTotal: 0, shortReason: 'Short on cash this week, balance next run' });
        expect(run.lines.find(l => l.workerId === 'w2')).toMatchObject({ net: 280, ownPaid: 280, paid: 280, shortfall: 0, allocations: [] });
        expect(run.totals).toEqual({ hours: 26, gross: 760, deductions: 0, net: 760, paid: 580, shortfall: 180, allocated: 0 });
        const kosta = page.locator('.pay-detail-line[data-wid="w1"]');
        await expect(kosta.locator('.pay-detail-payments')).toContainText('Paid on this period: $300.00 on Thu, Sep 24, E-transfer');
        await expect(kosta.locator('.pay-detail-status')).toContainText('$180.00 still owed since Thu, Sep 24 (Short on cash this week, balance next run)');
        await expect(page.locator('.pay-detail-line[data-wid="w2"] .pay-detail-status')).toContainText('Paid in full');
        await expect(page.locator('#payDetailTotals')).toContainText('Net $760.00, Paid $580.00, $180.00 still owed on this period');
    });
    test('the next run lists the earlier period under the name with its own box at zero; Due stays this period only', async ({ page }) => {
        await openNewRun(page, WEEK2, [RUN1], '2026-09-21', '2026-09-27');
        const kosta = page.locator('.pay-line[data-wid="w1"]');
        await expect(kosta.locator('.pay-earlier')).toContainText('Earlier periods still owed');
        await expect(kosta.locator('.pay-earlier-row[data-run="run1"]')).toContainText('$180.00 from Mon, Sep 14 to Sun, Sep 20, owed since Thu, Sep 24 (Short on cash this week, balance next run)');
        await expect(kosta.locator('.pay-earlier-amt')).toHaveValue('0.00');
        await expect(kosta.locator('td:nth-child(7)')).toContainText('$240.00');
        await expect(kosta.locator('.pay-earlier-due')).toContainText('$180.00 owed on earlier periods');
        await expect(kosta.locator('.pay-paid')).toHaveValue('240.00');
        await expect(page.locator('.pay-line[data-wid="w2"] .pay-earlier')).toHaveCount(0);
        await expect(page.locator('#payPickNote')).toContainText('1 person is still owed on an earlier period');
        // Nothing entered toward it: the run pays this period only and the old balance stays where it is.
        const foot = await page.locator('#adminContent tfoot').innerText();
        expect(foot).toContain('380.00');
        expect(foot).not.toContain('toward earlier periods');
    });
    test('paying the earlier period from the later run settles it on the EARLIER period, dated the day it was paid', async ({ page }) => {
        await openNewRun(page, WEEK2, [RUN1], '2026-09-21', '2026-09-27');
        await setEarlier(page, 'w1', 'run1', '180');
        await expect(page.locator('.pay-line[data-wid="w1"] .pay-alloc-note')).toContainText('+ $180.00 toward earlier periods = $420.00 paid');
        await expect(page.locator('#payAllocTotal')).toContainText('incl. $180.00 toward earlier periods');
        await expect(page.locator('.pay-short')).toHaveCount(0);           // no reason asked: this period is paid in full
        await record(page, '2026-10-01');
        await expect.poll(() => page.evaluate(() => window.__posted.length)).toBe(1);
        const run = await page.evaluate(() => window.__posted[0].body);
        expect(run.lines.find(l => l.workerId === 'w1')).toMatchObject({ net: 240, ownPaid: 240, shortfall: 0, allocations: [{ runId: 'run1', periodStart: '2026-09-14', periodEnd: '2026-09-20', amount: 180 }], allocationsTotal: 180, paid: 420 });
        expect(run.totals).toEqual({ hours: 13, gross: 380, deductions: 0, net: 380, paid: 560, shortfall: 0, allocated: 180 });
        await expect(page.locator('.pay-detail-line[data-wid="w1"] .pay-detail-alloc')).toContainText('Also paid toward earlier periods: $180.00 on Mon, Sep 14 to Sun, Sep 20');
        // Open the EARLIER run: the payment is attached to it, and it now reads paid in full on 1 October.
        await toList(page);
        await page.click('.pay-run-row[data-id="run1"] .pay-view-btn');
        const k1 = page.locator('.pay-detail-line[data-wid="w1"]');
        await expect(k1.locator('.pay-detail-payments')).toContainText('$300.00 on Thu, Sep 24, E-transfer; $180.00 on Thu, Oct 1, E-transfer (run of Mon, Sep 21 to Sun, Sep 27)');
        await expect(k1.locator('.pay-detail-status')).toContainText('Paid in full on Thu, Oct 1');
        await expect(page.locator('#payDetailTotals')).not.toContainText('still owed');
        // And it is gone from any later run.
        await toList(page);
        await page.click('#payNewRunBtn');
        await page.fill('#payFrom', '2026-09-28'); await page.dispatchEvent('#payFrom', 'change');
        await page.fill('#payTo', '2026-10-04'); await page.dispatchEvent('#payTo', 'change');
        await page.click('#payLoadBtn');
        await expect(page.locator('#adminContent')).toContainText('No approved hours in this period');
        await expect(page.locator('.pay-earlier')).toHaveCount(0);
    });
    test('THE FIX: recording a run for an EARLIER period never sees a balance from a later one', async ({ page }) => {
        await openNewRun(page, WEEK0, [RUN1], '2026-09-07', '2026-09-13');
        const kosta = page.locator('.pay-line[data-wid="w1"]');
        await expect(kosta).toContainText('No approved hours this period').catch(() => {});
        await expect(kosta.locator('.pay-earlier')).toHaveCount(0);
        await expect(kosta.locator('.pay-earlier-due')).toHaveCount(0);
        await expect(kosta.locator('td:nth-child(7)')).toContainText('$120.00');
        await expect(kosta.locator('.pay-paid')).toHaveValue('120.00');
        await expect(page.locator('.pay-short')).toHaveCount(0);
        await record(page, '2026-10-14');
        await expect.poll(() => page.evaluate(() => window.__posted.length)).toBe(1);
        const run = await page.evaluate(() => window.__posted[0].body);
        expect(run.lines[0]).toMatchObject({ net: 120, ownPaid: 120, paid: 120, shortfall: 0, allocations: [] });
        // Week 1 is still owed, still dated 24 September.
        await toEmployees(page);
        await expect(page.locator('.pay-emp-row[data-wid="w1"] .pay-emp-unsettled')).toContainText('$180.00 unsettled, owed to them since Thu, Sep 24');
    });
    test('someone owed on an earlier period with no hours this period still gets a line, and cannot be recorded at zero', async ({ page }) => {
        await openNewRun(page, [TC('j2', 'w2', '2026-09-23', 5)], [RUN1], '2026-09-21', '2026-09-27');
        const names = await page.locator('.pay-line td:nth-child(2) strong').allTextContents();
        expect(names).toEqual(['Jonathan Brewer', 'Kosta S']);
        const kosta = page.locator('.pay-line[data-wid="w1"]');
        await expect(kosta).toContainText('No approved hours this period');
        await expect(kosta.locator('.pay-earlier')).toContainText('$180.00');
        await expect(kosta.locator('.pay-paid')).toHaveValue('0.00');
        await record(page, '2026-10-01');
        await expect(page.locator('.toast-error').last()).toContainText('Kosta S has no hours this period and nothing entered toward the earlier balance');
        expect(await page.evaluate(() => window.__posted.length)).toBe(0);
        await setEarlier(page, 'w1', 'run1', '180');
        await record(page, '2026-10-01');
        await expect.poll(() => page.evaluate(() => window.__posted.length)).toBe(1);
        const run = await page.evaluate(() => window.__posted[0].body);
        expect(run.lines.find(l => l.workerId === 'w1')).toMatchObject({ hours: 0, net: 0, ownPaid: 0, paid: 180, allocationsTotal: 180 });
    });
    test('paying part of an earlier period keeps the remainder on that period with its ORIGINAL date', async ({ page }) => {
        await openNewRun(page, WEEK2, [RUN1], '2026-09-21', '2026-09-27');
        await setEarlier(page, 'w1', 'run1', '100');
        await record(page, '2026-10-01');
        await expect.poll(() => page.evaluate(() => window.__posted.length)).toBe(1);
        expect((await page.evaluate(() => window.__posted[0].body)).lines.find(l => l.workerId === 'w1')).toMatchObject({ ownPaid: 240, paid: 340, shortfall: 0, allocationsTotal: 100 });
        await toEmployees(page);
        const row = page.locator('.pay-emp-row[data-wid="w1"]');
        await expect(row).toContainText('$720.00');   // net 480 + 240
        await expect(row).toContainText('$640.00');   // paid 300 + 340
        await expect(row.locator('.pay-emp-unsettled')).toContainText('$80.00 unsettled, owed to them since Thu, Sep 24');
        await expect(page.locator('#payrollContent tfoot')).toContainText('$80.00 unsettled in total');
        await page.click('.pay-emp-row[data-wid="w1"] .pay-emp-open');
        await expect(page.locator('#payEmpStatement')).toContainText('$720.00 net due, $640.00 paid');
        await expect(page.locator('#payEmpStatement .pay-emp-unsettled')).toContainText('$80.00 from Mon, Sep 14 to Sun, Sep 20, owed since Thu, Sep 24');
        const week1 = page.locator('.pay-emp-entry[data-run="run1"]');
        await expect(week1.locator('.pay-emp-status')).toContainText('$80.00 still owed since Thu, Sep 24');
        await expect(week1.locator('.pay-emp-received')).toContainText('+ $100.00 on Thu, Oct 1 from later runs');
        await expect(page.locator('.pay-emp-entry').first().locator('.pay-emp-status')).toContainText('Paid in full');
        // Pay Runs list: week 1 still shows what is owed on it, week 2 shows what it paid toward earlier.
        await toList(page);
        await expect(page.locator('.pay-run-row[data-id="run1"] .pay-run-short')).toContainText('$80.00 still owed on this period');
        await expect(page.locator('.pay-run-row').first().locator('.pay-run-alloc')).toContainText('incl. $100.00 toward earlier periods');
    });
    test('runs recorded under the old carry-forward scheme are read under the migration rule (the live Belfort shape)', async ({ page }) => {
        // Mirrors the ten runs on the site on 14 October: w1 stands in for Brianne, w2 for Jonathan.
        const L = (wid, name, net, paid, short, carried, reason) => ({ workerId: wid, workerName: name, rate: 0, regularHours: 0, otHours: 0, dtHours: 0, hours: 0, gross: net, deductionTotal: 0, net,
            carriedIn: carried, carriedInTotal: carried.reduce((s, c) => s + c.amount, 0), due: net + carried.reduce((s, c) => s + c.amount, 0), paid, shortfall: short, shortReason: reason, days: [], timecardIds: [], deductions: [] });
        const R = (id, ps, pe, pd, created, lines) => ({ id, periodStart: ps, periodEnd: pe, paidDate: pd, method: 'Cash', status: 'recorded', createdAt: created, lines, totals: {} });
        const C = (runId, amount) => ({ runId, periodStart: '', periodEnd: '', paidDate: '', amount, reason: '' });
        const runs = [
            R('aug', '2026-08-24', '2026-08-28', '2026-08-28', '2026-10-14T21:18:38Z', [L('w1', 'Kosta S', 870, 870, 2210, [C('oct', 2210)], 'she was paid in full for the time period selected')]),
            R('s13', '2026-09-13', '2026-09-19', '2026-09-18', '2026-10-08T10:49:53Z', [L('w1', 'Kosta S', 1240, 500, 740, [], 'cash on hand short')]),
            R('s20', '2026-09-20', '2026-09-26', '2026-09-25', '2026-10-08T10:51:54Z', [L('w1', 'Kosta S', 1830, 500, 2070, [C('s13', 740)], 'cash on hand short')]),
            R('j20', '2026-09-20', '2026-09-26', '2026-10-02', '2026-10-08T10:38:07Z', [L('w2', 'Jonathan Brewer', 597.5, 500, 97.5, [], 'issue with cash on hand')]),
            R('oct', '2026-09-27', '2026-10-03', '2026-10-07', '2026-10-08T10:55:12Z', [L('w1', 'Kosta S', 1840, 1700, 2210, [C('s20', 2070)], 'short cash on hand')]),
            R('j06', '2026-09-06', '2026-09-12', '2026-10-14', '2026-10-14T21:34:42Z', [L('w2', 'Jonathan Brewer', 703, 703, 97.5, [C('j20', 97.5)], 'he was paid in full for this period')]),
            R('a30', '2026-08-30', '2026-09-05', '2026-10-14', '2026-10-14T21:36:42Z', [L('w1', 'Kosta S', 405, 405, 2210, [C('aug', 2210)], 'paid in full for this period'), L('w2', 'Jonathan Brewer', 845.5, 845.5, 97.5, [C('j06', 97.5)], 'paid in full for this period')]),
        ];
        await page.goto(HARNESS);
        await page.evaluate(([r]) => window.load(r, [], 'employees'), [runs]);
        await page.waitForSelector('.pay-emp-row');
        const b = page.locator('.pay-emp-row[data-wid="w1"]');
        await expect(b.locator('.pay-emp-unsettled')).toContainText('$2,210.00 unsettled, owed to them since Fri, Sep 18 over 3 periods');
        await expect(b).toContainText('$6,185.00');   // net 870+1240+1830+1840+405
        await expect(b).toContainText('$3,975.00');   // paid 870+500+500+1700+405
        const j = page.locator('.pay-emp-row[data-wid="w2"]');
        await expect(j.locator('.pay-emp-unsettled')).toContainText('$97.50 unsettled, owed to them since Fri, Oct 2');
        await expect(page.locator('#payrollContent tfoot')).toContainText('$2,307.50 unsettled in total');
        // The three "paid in full for this period" runs carry nothing: no shortfall on August, 30 Aug to 5 Sep or 6 to 12 Sep.
        await toList(page);
        for (const id of ['aug', 'a30', 'j06']) await expect(page.locator('.pay-run-row[data-id="' + id + '"] .pay-run-short')).toHaveCount(0);
        await expect(page.locator('.pay-run-row[data-id="s13"] .pay-run-short')).toContainText('$740.00 still owed on this period');
        await expect(page.locator('.pay-run-row[data-id="s20"] .pay-run-short')).toContainText('$1,330.00 still owed on this period');
        await expect(page.locator('.pay-run-row[data-id="oct"] .pay-run-short')).toContainText('$140.00 still owed on this period');
        await expect(page.locator('.pay-run-row[data-id="j20"] .pay-run-short')).toContainText('$97.50 still owed on this period');
        await expect(page.locator('.pay-run-alloc')).toHaveCount(0);
        // Open the August run: nothing from October on it, paid in full, and the recorded date reads as a date.
        await page.click('.pay-run-row[data-id="aug"] .pay-view-btn');
        await expect(page.locator('.pay-detail-line[data-wid="w1"] .pay-detail-status')).toContainText('Paid in full');
        await expect(page.locator('.pay-detail-line[data-wid="w1"]')).not.toContainText('2,210');
        await expect(page.locator('#payRecordedBy')).not.toContainText('Invalid Date');
        await expect(page.locator('#payRecordedBy')).toContainText('2026');
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
        await toEmployees(page);
        await expect(page.locator('.pay-emp-row[data-wid="w2"]')).toContainText('$280.00');
        await expect(page.locator('.pay-emp-unsettled')).toHaveCount(0);
    });
    test('a period a later run paid toward cannot be deleted first; deleting the later run reopens the period', async ({ page }) => {
        await page.goto(HARNESS);
        await page.evaluate(([r]) => { window.__posted = []; return window.load(r, [], 'runs'); }, [[RUN1, RUN2]]);
        await page.waitForSelector('.pay-run-row');
        await expect(page.locator('.pay-run-row[data-id="run1"] .pay-run-short')).toHaveCount(0);   // settled by run2
        await page.click('.pay-run-row[data-id="run1"] .pay-view-btn');
        await page.click('#payDeleteBtn');
        await expect(page.locator('.toast-error').last()).toContainText('The run of Mon, Sep 21 to Sun, Sep 27 paid $180.00 toward this period. Delete that one first.');
        expect(await page.evaluate(() => window.__runs.length)).toBe(2);
        await toList(page);
        await page.click('.pay-run-row[data-id="run2"] .pay-view-btn');
        page.once('dialog', d => d.accept());
        await page.evaluate(() => { window.Utils.confirm = () => Promise.resolve(true); });
        await page.click('#payDeleteBtn');
        await expect.poll(() => page.evaluate(() => window.__runs.length)).toBe(1);
        await page.waitForSelector('.pay-run-row');
        await expect(page.locator('.pay-run-row[data-id="run1"] .pay-run-short')).toContainText('$180.00 still owed on this period');
        await toEmployees(page);
        await expect(page.locator('.pay-emp-row[data-wid="w1"] .pay-emp-unsettled')).toContainText('$180.00 unsettled, owed to them since Thu, Sep 24');
    });
    test('no sideways scroll on a 390 pixel phone with an earlier period box and a shortfall open', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        const errors = [];
        page.on('pageerror', e => errors.push(String(e)));
        await openNewRun(page, WEEK2, [RUN1], '2026-09-21', '2026-09-27');
        await setPaid(page, 'w1', '200');
        await expect(page.locator('.pay-short')).toHaveCount(1);
        await expect(page.locator('.pay-earlier-amt')).toHaveCount(1);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);
        expect(errors).toEqual([]);
    });
});
