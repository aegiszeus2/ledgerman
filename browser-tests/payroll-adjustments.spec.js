// payroll-adjustments.spec.js
// Damiano, 16 October, four asks on Payroll:
//   1. the Deductions tab explains what Owing means;
//   2. a recorded pay run can be edited;
//   3. "No approved hours" says whether nothing was approved or everything is already paid;
//   4. a person can be paid over or under what is due, with an optional note, and the
//      difference carries forward to their next period (an overpayment comes off the next run).
// Harness, no network. Payroll is admin-only on the server, so this is the admin login only.
const { test, expect } = require('@playwright/test');
const HARNESS = '/browser-tests/harness-payroll.html';
const TC = (id, wid, date, hrs) => ({ id, workerId: wid, date, projectId: 'p1', status: 'approved', regularHours: hrs, otHours: 0, dtHours: 0 });
const WEEK1 = [TC('k1', 'w1', '2026-09-16', 8), TC('k2', 'w1', '2026-09-17', 8), TC('j1', 'w2', '2026-09-16', 10)];   // Kosta 480, Jonathan 280
const WEEK2 = [TC('k3', 'w1', '2026-09-23', 8), TC('j2', 'w2', '2026-09-23', 5)];                                      // Kosta 240, Jonathan 140
// Week 1 recorded under the old scheme: Kosta paid 300 of 480, Jonathan paid in full with a $50 deduction taken.
const RUN1 = {
    id: 'run1', periodStart: '2026-09-14', periodEnd: '2026-09-20', paidDate: '2026-09-24', method: 'E-transfer', reference: 'ET-1', notes: 'first run',
    status: 'recorded', createdBy: 'Damiano', createdAt: '2026-09-24T18:00:00Z',
    lines: [
        { workerId: 'w1', workerName: 'Kosta S', rate: 30, regularHours: 16, otHours: 0, dtHours: 0, hours: 16, gross: 480, deductionTotal: 0, net: 480,
          carriedIn: [], carriedInTotal: 0, due: 480, paid: 300, shortfall: 180, shortReason: 'Short on cash this week',
          days: [{ date: '2026-09-16', projectName: 'Yard Work 4062', hours: 8 }, { date: '2026-09-17', projectName: 'Yard Work 4062', hours: 8 }], timecardIds: ['k1', 'k2'], deductions: [] },
        { workerId: 'w2', workerName: 'Jonathan Brewer', rate: 28, regularHours: 10, otHours: 0, dtHours: 0, hours: 10, gross: 280, deductionTotal: 50, net: 230,
          carriedIn: [], carriedInTotal: 0, due: 230, paid: 230, shortfall: 0, shortReason: '',
          days: [{ date: '2026-09-16', projectName: 'Yard Work 4062', hours: 10 }], timecardIds: ['j1'], deductions: [{ deductionId: 'd1', description: 'Work boots', type: 'Purchase for employee', amount: 50 }] }
    ],
    totals: { hours: 26, gross: 760, deductions: 50, net: 710, carriedIn: 0, due: 710, paid: 530, shortfall: 180 }
};
const DED1 = { id: 'd1', workerId: 'w2', date: '2026-09-10', amount: 50, type: 'Purchase for employee', description: 'Work boots', recovered: 50, status: 'applied', applications: [{ runId: 'run1', amount: 50, paidDate: '2026-09-24' }] };
// Week 1 under the new scheme with Kosta OVERPAID: 580 against a 480 net.
const RUN_OVER = {
    id: 'runo', periodStart: '2026-09-14', periodEnd: '2026-09-20', paidDate: '2026-09-24', method: 'E-transfer', status: 'recorded', ledger: 'periods', createdBy: 'Damiano', createdAt: '2026-09-24T18:00:00Z',
    lines: [{ workerId: 'w1', workerName: 'Kosta S', rate: 30, regularHours: 16, otHours: 0, dtHours: 0, hours: 16, gross: 480, deductionTotal: 0, net: 480,
        ownPaid: 580, shortfall: 0, overpaid: 100, adjustReason: 'Rounded up to cover his gas', shortReason: '', allocations: [], allocationsTotal: 0, allocationsPaid: 0, allocationsRecovered: 0, paid: 580,
        days: [], timecardIds: ['k1', 'k2'], deductions: [] }],
    totals: { hours: 16, gross: 480, deductions: 0, net: 480, paid: 580, shortfall: 0, overpaid: 100, allocated: 0, allocatedPaid: 0, recovered: 0 }
};
// A later run that paid 180 toward run1's Kosta period.
const RUN2 = {
    id: 'run2', periodStart: '2026-09-21', periodEnd: '2026-09-27', paidDate: '2026-10-01', method: 'E-transfer', status: 'recorded', ledger: 'periods', createdAt: '2026-10-01T18:00:00Z',
    lines: [{ workerId: 'w1', workerName: 'Kosta S', rate: 30, regularHours: 8, otHours: 0, dtHours: 0, hours: 8, gross: 240, deductionTotal: 0, net: 240,
        ownPaid: 240, shortfall: 0, shortReason: '', allocations: [{ runId: 'run1', periodStart: '2026-09-14', periodEnd: '2026-09-20', amount: 180 }], allocationsTotal: 180, paid: 420,
        days: [], timecardIds: ['k3'], deductions: [] }],
    totals: { hours: 8, gross: 240, deductions: 0, net: 240, paid: 420, shortfall: 0, allocated: 180 }
};
async function openNewRun(page, approved, runs, from, to, deds) {
    await page.goto(HARNESS);
    await page.evaluate(([a, r, d]) => { window.__approved = a; window.__posted = []; return window.load(r || [], d || [], 'runs'); }, [approved, runs || [], deds || []]);
    await page.waitForSelector('#payNewRunBtn');
    await page.click('#payNewRunBtn');
    await page.fill('#payFrom', from); await page.dispatchEvent('#payFrom', 'change');
    await page.fill('#payTo', to); await page.dispatchEvent('#payTo', 'change');
    await page.click('#payLoadBtn');
    await page.waitForSelector('.pay-line, #payNoHours');
}
async function openEdit(page, runs, deds, runId) {
    await page.goto(HARNESS);
    await page.evaluate(([r, d]) => { window.__posted = []; return window.load(r, d || [], 'runs'); }, [runs, deds || []]);
    await page.click('.pay-view-btn[data-id="' + runId + '"]');
    await page.waitForSelector('#payEditBtn');
    await page.click('#payEditBtn');
    await page.waitForSelector('#payFormTitle');
}
async function setPaid(page, wid, value) {
    await page.fill('.pay-line[data-wid="' + wid + '"] .pay-paid', value);
    await page.dispatchEvent('.pay-line[data-wid="' + wid + '"] .pay-paid', 'change');
}
async function record(page, paidDate) {
    if (paidDate) { await page.fill('#payPaidDate', paidDate); await page.dispatchEvent('#payPaidDate', 'change'); }
    await page.click('#payRecordBtn');
}
const posted = (page) => page.evaluate(() => window.__posted);

test.describe('Payroll: Owing explained, editable runs, clearer empty state, over and under payments', () => {

    // 1. Owing
    test('the Deductions tab says what Owing means', async ({ page }) => {
        await page.goto(HARNESS);
        await page.evaluate(() => window.load([], [{ id: 'd9', workerId: 'w1', date: '2026-09-10', amount: 120, type: 'Advance repayment', description: 'Advance', recovered: 20, status: 'open' }], 'deductions'));
        await expect(page.locator('#dedOwingNote')).toContainText('What Owing means');
        await expect(page.locator('#dedOwingNote')).toContainText('how much of it they still have to pay back: the amount of the deduction less what has already been recovered off their pay runs');
        await expect(page.locator('#dedOwingNote')).toContainText('It is not money the company owes them');
        await expect(page.locator('th[title="Still to be paid back: amount less recovered"]')).toHaveText('Owing');
        await expect(page.locator('tbody tr').first()).toContainText('$100.00');
    });

    // 3. Empty state
    test('nothing approved in the period says so plainly', async ({ page }) => {
        await openNewRun(page, [], [], '2026-09-14', '2026-09-20');
        await expect(page.locator('#payNoHours')).toHaveAttribute('data-state', 'none');
        await expect(page.locator('#payNoHours h3')).toHaveText('No approved hours in this period');
        await expect(page.locator('#payNoHours')).toContainText('Nothing approved between these dates.');
    });
    test('approved hours all on a recorded run says they are already paid, and names the run', async ({ page }) => {
        await openNewRun(page, WEEK1, [RUN1], '2026-09-14', '2026-09-20');
        await expect(page.locator('#payNoHours')).toHaveAttribute('data-state', 'all-paid');
        await expect(page.locator('#payNoHours h3')).toHaveText('All approved hours in this period have already been paid');
        await expect(page.locator('#payNoHours')).toContainText('3 approved timecards between these dates, and all 3 are already on a recorded run. There is nothing left to pay for this period.');
        await expect(page.locator('#payNoHours li')).toContainText('Mon, Sep 14 to Sun, Sep 20, paid Thu, Sep 24: 3 cards (Kosta S, Jonathan Brewer)');
        await page.click('#payNoHours .pay-view-btn');
        await expect(page.locator('h2')).toContainText('Pay Run, Mon, Sep 14 to Sun, Sep 20');
    });
    test('a period that is part paid lists the people still to pay and names the run the rest sat on', async ({ page }) => {
        const RUN_K = Object.assign({}, RUN1, { id: 'runk', lines: [RUN1.lines[0]] });   // Kosta's two cards only
        await openNewRun(page, WEEK1, [RUN_K], '2026-09-14', '2026-09-20');
        await expect(page.locator('.pay-line')).toHaveCount(1);
        await expect(page.locator('.pay-line[data-wid="w2"]')).toHaveCount(1);
        await expect(page.locator('#payLoadNotes')).toContainText('2 approved timecards already paid in an earlier run, left out: the run of Mon, Sep 14 to Sun, Sep 20, paid Thu, Sep 24 (2 cards, Kosta S).');
    });

    // 4. Over and under
    test('paying more than due is allowed: shown as an overpayment with an optional note, confirmed, then recorded on the period', async ({ page }) => {
        await openNewRun(page, WEEK1, [], '2026-09-14', '2026-09-20');
        await setPaid(page, 'w1', '580');
        const kosta = page.locator('.pay-line[data-wid="w1"]');
        await expect(kosta.locator('.pay-paid')).toHaveValue('580.00');
        await expect(kosta.locator('.pay-over')).toContainText('$100.00 over, an overpayment; it comes off their next pay.');
        await expect(kosta.locator('.pay-adjust-reason')).toHaveAttribute('placeholder', 'Why (optional)');
        await expect(page.locator('#payOverTotal')).toContainText('$100.00 overpaid on this period, carried to the next');
        const foot = await page.locator('#adminContent tfoot').innerText();
        expect(foot).toContain('760.00');   // net
        expect(foot).toContain('860.00');   // paid
        await page.fill('.pay-line[data-wid="w1"] .pay-adjust-reason', 'Rounded up to cover his gas');
        await page.dispatchEvent('.pay-line[data-wid="w1"] .pay-adjust-reason', 'input');
        await record(page, '2026-09-24');
        // A slipped digit never goes through unseen: the overpayment is confirmed first.
        await expect(page.locator('#confirmDialogTitle')).toBeVisible();
        await expect(page.locator('.modal-body')).toContainText('Kosta S $100.00 more than due this period. The extra is recorded as an overpayment and comes off their next pay.');
        expect((await posted(page)).length).toBe(0);
        await page.click('#confirmYes');
        await expect.poll(() => page.evaluate(() => window.__posted.length)).toBe(1);
        const run = (await posted(page))[0].body;
        expect(run.ledger).toBe('periods');
        expect(run.lines.find(l => l.workerId === 'w1')).toMatchObject({ net: 480, ownPaid: 580, paid: 580, shortfall: 0, overpaid: 100, adjustReason: 'Rounded up to cover his gas', shortReason: '', allocations: [] });
        expect(run.totals).toMatchObject({ net: 760, paid: 860, shortfall: 0, overpaid: 100, recovered: 0 });
        await expect(page.locator('.pay-detail-line[data-wid="w1"] .pay-detail-status')).toContainText('$100.00 overpaid on Thu, Sep 24, comes off their next pay (Rounded up to cover his gas)');
        await expect(page.locator('#payDetailTotals')).toContainText('Paid $860.00, $100.00 overpaid on this period');
    });
    test('cancelling the overpayment confirmation records nothing', async ({ page }) => {
        await openNewRun(page, WEEK1, [], '2026-09-14', '2026-09-20');
        await setPaid(page, 'w1', '4800');   // the slipped digit
        await record(page, '2026-09-24');
        await expect(page.locator('.modal-body')).toContainText('Kosta S $4,320.00 more than due this period');
        await page.click('#confirmNo');
        await page.waitForTimeout(200);
        expect((await posted(page)).length).toBe(0);
    });
    test('the next run carries the overpayment forward under the name and recovers it off this period\'s pay', async ({ page }) => {
        await openNewRun(page, WEEK2, [RUN_OVER], '2026-09-21', '2026-09-27');
        const kosta = page.locator('.pay-line[data-wid="w1"]');
        await expect(kosta.locator('.pay-earlier')).toContainText('Carried forward from earlier periods');
        const row = kosta.locator('.pay-earlier-row[data-run="runo"]');
        await expect(row).toHaveAttribute('data-kind', 'over');
        await expect(row).toContainText('$100.00 overpaid on Mon, Sep 14 to Sun, Sep 20, paid Thu, Sep 24 (Rounded up to cover his gas)');
        await expect(row).toContainText('Recover now');
        await expect(row.locator('.pay-earlier-amt')).toHaveValue('100.00');          // comes off the next pay by default
        await expect(kosta.locator('.pay-paid')).toHaveValue('240.00');                 // this period's own net, untouched
        await expect(kosta.locator('.pay-earlier-over')).toContainText('$100.00 overpaid earlier, to recover');
        await expect(kosta.locator('.pay-alloc-note')).toContainText('$100.00 recovered from the earlier overpayment');
        await expect(kosta.locator('.pay-alloc-note')).toContainText('= $140.00 paid');
        await expect(page.locator('#payRecovTotal')).toContainText('less $100.00 recovered from earlier overpayments');
        await expect(page.locator('#payOverTotal')).toHaveCount(0);
        await expect(page.locator('.pay-line[data-wid="w2"] .pay-earlier')).toHaveCount(0);
        await record(page, '2026-10-01');
        await expect.poll(() => page.evaluate(() => window.__posted.length)).toBe(1);
        const run = (await posted(page))[0].body;
        expect(run.lines.find(l => l.workerId === 'w1')).toMatchObject({ net: 240, ownPaid: 240, shortfall: 0, overpaid: 0, paid: 140, allocationsTotal: -100, allocationsPaid: 0, allocationsRecovered: 100 });
        expect(run.lines.find(l => l.workerId === 'w1').allocations).toEqual([{ runId: 'runo', periodStart: '2026-09-14', periodEnd: '2026-09-20', amount: -100 }]);
        expect(run.totals).toMatchObject({ net: 380, paid: 280, recovered: 100, allocated: -100 });
        // Run detail: this period paid in full, the recovery named.
        await expect(page.locator('.pay-detail-line[data-wid="w1"] .pay-detail-status')).toContainText('Paid in full');
        await expect(page.locator('.pay-detail-line[data-wid="w1"] .pay-detail-alloc')).toContainText('$100.00 recovered from the overpayment on Mon, Sep 14 to Sun, Sep 20');
        // The earlier period is now settled, and the Employees tab no longer shows an overpayment.
        await page.evaluate(() => { AdminPayroll._view = 'list'; AdminPayroll._tab = 'runs'; AdminPayroll._renderContent(); });
        await expect(page.locator('.pay-run-over')).toHaveCount(0);
        await expect(page.locator('.pay-run-recov')).toContainText('less $100.00 recovered from earlier overpayments');
        await page.evaluate(() => { AdminPayroll._tab = 'employees'; AdminPayroll._empId = ''; AdminPayroll._renderContent(); });
        await expect(page.locator('.pay-emp-overpaid')).toHaveCount(0);
        await expect(page.locator('.pay-emp-row[data-wid="w1"]')).toContainText('$720.00');   // 580 + 140 paid = 720 net earned
    });
    test('an open overpayment shows on the Pay Runs list and the Employees tab until recovered', async ({ page }) => {
        await page.goto(HARNESS);
        await page.evaluate(([r]) => window.load(r, [], 'runs'), [[RUN_OVER]]);
        await expect(page.locator('.pay-run-over')).toContainText('$100.00 overpaid on this period');
        await page.evaluate(() => { AdminPayroll._tab = 'employees'; AdminPayroll._renderContent(); });
        await expect(page.locator('.pay-emp-row[data-wid="w1"] .pay-emp-overpaid')).toContainText('$100.00 overpaid on Thu, Sep 24, comes off their next pay');
        await page.evaluate(() => { AdminPayroll._empId = 'w1'; AdminPayroll._renderContent(); });
        await expect(page.locator('#payEmpStatement .pay-emp-overpaid')).toContainText('$100.00 overpaid to Kosta S: $100.00 overpaid on Mon, Sep 14 to Sun, Sep 20, paid Thu, Sep 24 (Rounded up to cover his gas). It comes off their next pay run');
    });
    test('a recovery can never exceed what is being paid out on the line', async ({ page }) => {
        await openNewRun(page, WEEK2, [RUN_OVER], '2026-09-21', '2026-09-27');
        await setPaid(page, 'w1', '50');   // only 50 of 240 paid this period, so at most 50 can be recovered
        const kosta = page.locator('.pay-line[data-wid="w1"]');
        await expect(kosta.locator('.pay-earlier-amt')).toHaveValue('50.00');
        await expect(kosta.locator('.pay-alloc-note')).toContainText('= $0.00 paid');
    });

    // 2. Edit
    test('Edit run opens the recorded run on the form with the period fixed and the saved amounts in place', async ({ page }) => {
        await openEdit(page, [RUN1], [DED1], 'run1');
        await expect(page.locator('#payFormTitle')).toHaveText('Edit Pay Run, Mon, Sep 14 to Sun, Sep 20');
        await expect(page.locator('#payFrom')).toBeDisabled();
        await expect(page.locator('#payTo')).toBeDisabled();
        await expect(page.locator('#payLoadBtn')).toHaveCount(0);
        await expect(page.locator('#payPickNote')).toContainText('This run is already recorded');
        await expect(page.locator('.pay-line[data-wid="w1"] .pay-paid')).toHaveValue('300.00');
        await expect(page.locator('.pay-line[data-wid="w1"] .pay-short')).toContainText('$180.00 short');
        await expect(page.locator('.pay-line[data-wid="w1"] .pay-adjust-reason')).toHaveValue('Short on cash this week');
        await expect(page.locator('.pay-line[data-wid="w2"] .pay-ded-locked')).toContainText('$50.00 Work boots (taken in this run)');
        await expect(page.locator('#payPaidDate')).toHaveValue('2026-09-24');
        await expect(page.locator('#payRef')).toHaveValue('ET-1');
        await expect(page.locator('#payNotes')).toHaveValue('first run');
        await expect(page.locator('#payRecordBtn')).toHaveText('Save changes');
        await page.click('#payBackBtn');   // Cancel goes back to the run, nothing saved
        await expect(page.locator('h2')).toContainText('Pay Run, Mon, Sep 14 to Sun, Sep 20');
        expect((await posted(page)).length).toBe(0);
    });
    test('saving an edit writes the same run id with the new money and keeps who recorded it', async ({ page }) => {
        await openEdit(page, [RUN1], [DED1], 'run1');
        await setPaid(page, 'w1', '480');
        await expect(page.locator('.pay-line[data-wid="w1"] .pay-short')).toHaveCount(0);
        await page.fill('#payPaidDate', '2026-09-25'); await page.dispatchEvent('#payPaidDate', 'change');
        await page.fill('#payRef', 'ET-1 and ET-2'); await page.dispatchEvent('#payRef', 'input');
        await page.click('#payRecordBtn');
        await expect.poll(() => page.evaluate(() => window.__posted.length)).toBe(1);
        const body = (await posted(page))[0].body;
        expect(body.id).toBe('run1');
        expect(body).toMatchObject({ periodStart: '2026-09-14', periodEnd: '2026-09-20', paidDate: '2026-09-25', reference: 'ET-1 and ET-2', notes: 'first run', createdBy: 'Damiano', createdAt: '2026-09-24T18:00:00Z', updatedBy: 'Damiano', ledger: 'periods' });
        expect(body.lines.find(l => l.workerId === 'w1')).toMatchObject({ net: 480, ownPaid: 480, paid: 480, shortfall: 0, overpaid: 0, timecardIds: ['k1', 'k2'] });
        expect(body.lines.find(l => l.workerId === 'w2')).toMatchObject({ net: 230, paid: 230, deductionTotal: 50, deductions: [{ deductionId: 'd1', amount: 50 }] });
        expect(body.totals).toMatchObject({ net: 710, paid: 710, shortfall: 0 });
        expect(body.edits).toEqual([expect.objectContaining({ by: 'Damiano', paidBefore: 530, paidAfter: 710 })]);
        // Back on the run: edited stamp, paid in full, nothing owed.
        await expect(page.locator('#payRecordedBy')).toContainText('Recorded by Damiano');
        await expect(page.locator('#payRecordedBy')).toContainText('edited by Damiano');
        await expect(page.locator('.pay-detail-line[data-wid="w1"] .pay-detail-status')).toContainText('Paid in full');
        await expect(page.locator('#payDetailTotals')).not.toContainText('still owed');
    });
    test('unticking a person on an edit takes them off the run and reopens the deductions taken from them', async ({ page }) => {
        await openEdit(page, [RUN1], [DED1], 'run1');
        await page.uncheck('.pay-line-include[data-i="1"]');   // Jonathan
        await expect(page.locator('.pay-line[data-wid="w2"]')).toContainText('taken off this run on save');
        await page.click('#payRecordBtn');
        await expect.poll(() => page.evaluate(() => window.__posted.length)).toBe(2);
        const all = await posted(page);
        const run = all.find(x => x.url.indexOf('/api/payroll_runs') !== -1).body;
        expect(run.id).toBe('run1');
        expect(run.lines.map(l => l.workerId)).toEqual(['w1']);
        const ded = all.find(x => x.url.indexOf('/api/payroll_deductions') !== -1).body;
        expect(ded).toMatchObject({ id: 'd1', recovered: 0, status: 'open', applications: [] });
    });
    test('an edit cannot take off someone a later run has already paid toward on this period', async ({ page }) => {
        await openEdit(page, [RUN1, RUN2], [], 'run1');
        await page.uncheck('.pay-line-include[data-i="0"]');   // Kosta, whom run2 paid 180 toward
        await page.click('#payRecordBtn');
        await expect(page.locator('.toast-error').last()).toContainText('The run of Mon, Sep 21 to Sun, Sep 27 paid $180.00 toward Kosta S on this period. Delete that one first, or keep Kosta S on this run.');
        expect((await posted(page)).length).toBe(0);
    });
    test('an edit can turn a short payment into an overpayment, and it is confirmed like a new run', async ({ page }) => {
        await openEdit(page, [RUN1], [DED1], 'run1');
        await setPaid(page, 'w1', '500');
        await expect(page.locator('.pay-line[data-wid="w1"] .pay-over')).toContainText('$20.00 over');
        await page.click('#payRecordBtn');
        await expect(page.locator('.modal-body')).toContainText('Kosta S $20.00 more than due this period');
        await page.click('#confirmYes');
        await expect.poll(() => page.evaluate(() => window.__posted.length)).toBe(1);
        expect((await posted(page))[0].body.lines.find(l => l.workerId === 'w1')).toMatchObject({ ownPaid: 500, overpaid: 20, shortfall: 0, paid: 500 });
    });
});
