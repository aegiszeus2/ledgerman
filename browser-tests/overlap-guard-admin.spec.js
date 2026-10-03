// overlap-guard-admin.spec.js
// Damiano, 3 October: Time Approvals shows an amber band on any card flagged for an
// overlap and on the card it collides with, Approve on a flagged card asks first,
// Bulk Approve skips flagged cards and says how many, and the Edit modal carries the
// overlap reason (revealed when the server refuses an edit for an overlap).
const { test, expect } = require('@playwright/test');

const HARNESS = '/browser-tests/harness-approvals.html';
const SUB = (id, over) => Object.assign({
    id: id, workerId: 'w1', projectId: 'p1', date: '2026-10-02', status: 'Pending', rateType: 'Hourly',
    hours: 8.5, rate: 0, startTime: '07:00', endTime: '15:30', description: 'desc ' + id,
    entryMethod: 'Manual Entry', createdAt: '2026-10-02T20:00:00Z', overlapsWith: [], overlapKind: '', overlapReason: '',
}, over || {});
const DATA = () => [
    SUB('A'),
    SUB('B', { startTime: '12:00', endTime: '18:00', hours: 6, overlapsWith: ['A'], overlapKind: 'overlap', overlapReason: 'split day' }),
    SUB('C', { date: '2026-10-01' }),
    SUB('D', { workerId: 'w2', projectId: 'p2', date: '2026-09-30', startTime: '', endTime: '', hours: 4 }),
    SUB('E', { workerId: 'w2', projectId: 'p2', date: '2026-09-30', startTime: '', endTime: '', hours: 4, overlapsWith: ['D'], overlapKind: 'same_job_day' }),
    SUB('F', { workerId: 'w2', projectId: 'p1', date: '2026-09-29', startTime: '', endTime: '', hours: 8 }),
    SUB('G', { workerId: 'w2', projectId: 'p2', date: '2026-09-29', startTime: '', endTime: '', hours: 7, overlapsWith: ['F'], overlapKind: 'long_day' }),
];

async function open(page, subs) {
    await page.goto(HARNESS);
    await page.evaluate(() => {
        window.__saves = [];
        window.AppData.saveEntityAsync = function(entity, item) { window.__saves.push({ entity: entity, item: JSON.parse(JSON.stringify(item)) }); return Promise.resolve(item); };
        window.AppData.addAuditLog = function() {};
        window.AppData.syncFromServer = function() { return Promise.resolve(); };
        window.AppData.deleteExpense = function() {};
        window.AppData.getPhoto = function() { return Promise.resolve(null); };
        window.__toasts = [];
        const t = window.Utils.showToast; window.Utils.showToast = function(m, k) { window.__toasts.push({ msg: m, kind: k }); return t && t.call(window.Utils, m, k); };
    });
    await page.evaluate((s) => window.load(s, []), subs || DATA());
    await page.waitForSelector('#approvalContent .card');
}
const card = (page, id) => page.locator('.card[data-sub-id="' + id + '"]');
const band = (page, id) => card(page, id).locator('.appr-overlap');
const saves = (page) => page.evaluate(() => window.__saves);

test.describe('Time Approvals overlap flags', () => {

    test('both sides of an overlap carry the amber band, clean cards do not', async ({ page }) => {
        await open(page);
        await expect(band(page, 'B')).toHaveCount(1);
        await expect(band(page, 'B')).toContainText("Overlaps Kosta's 07:00 to 15:30 card on Yard Work 4062.");
        await expect(band(page, 'B')).toContainText('Reason given: split day');
        await expect(band(page, 'A')).toHaveCount(1);
        await expect(band(page, 'A')).toContainText('Overlapped by the 12:00 to 18:00 card on Yard Work 4062. Reason given: split day.');
        await expect(band(page, 'C')).toHaveCount(0);
    });

    test('hours-only flags read as a doubled job or a long day', async ({ page }) => {
        await open(page);
        await expect(band(page, 'E')).toContainText('Second card on Sand and Stone Resort, Landscaping this day, hours only. Check it is not a double of the 4 hour card, hours only.');
        await expect(band(page, 'D')).toContainText('Overlapped by the 4 hour card, hours only on Sand and Stone Resort, Landscaping.');
        await expect(band(page, 'G')).toContainText('Long day: 15 hours logged this day with the 8 hour card, hours only on Yard Work 4062.');
    });

    test('Approve on a flagged card asks first; cancel leaves it pending, confirm approves', async ({ page }) => {
        await open(page);
        await card(page, 'B').locator('.approve-btn').click();
        await expect(page.locator('#confirmDialogTitle')).toBeVisible();
        await expect(page.locator('.modal-overlay')).toContainText('This card overlaps another entry Kosta S has for the same day. Approve it anyway?');
        await page.click('#confirmNo');
        expect((await saves(page)).length).toBe(0);
        await expect(card(page, 'B')).toHaveCount(1);
        await card(page, 'B').locator('.approve-btn').click();
        await page.click('#confirmYes');
        await page.waitForFunction(() => window.__saves.some(s => s.entity === 'submissions'));
        const sub = (await saves(page)).filter(s => s.entity === 'submissions')[0].item;
        expect(sub.id).toBe('B');
        expect(sub.status).toBe('Approved');
    });

    test('Approve on a clean card does not ask', async ({ page }) => {
        await open(page);
        await card(page, 'C').locator('.approve-btn').click();
        await page.waitForFunction(() => window.__saves.some(s => s.entity === 'submissions'));
        expect(await page.$('#confirmDialogTitle')).toBeNull();
        expect((await saves(page)).filter(s => s.entity === 'submissions')[0].item.id).toBe('C');
    });

    test('Bulk Approve skips flagged cards and says how many', async ({ page }) => {
        await open(page);
        await page.click('#bulkApproveBtn');
        await expect(page.locator('.modal-overlay')).toContainText('Approve 1 pending submissions? 6 flagged for an overlap will be skipped, approve those one at a time.');
        await page.click('#confirmYes');
        await page.waitForFunction(() => window.__toasts.some(t => /approved/.test(t.msg)));
        const approved = (await saves(page)).filter(s => s.entity === 'submissions').map(s => s.item.id);
        expect(approved).toEqual(['C']);
        const toasts = await page.evaluate(() => window.__toasts.map(t => t.msg));
        expect(toasts[toasts.length - 1]).toBe('1 submissions approved, 6 skipped for overlap');
    });

    test('Bulk Approve with only flagged cards pending refuses and says so', async ({ page }) => {
        await open(page, DATA().filter(s => s.id !== 'C'));
        await page.click('#bulkApproveBtn');
        expect(await page.$('#confirmDialogTitle')).toBeNull();
        const toasts = await page.evaluate(() => window.__toasts.map(t => t.msg));
        expect(toasts[toasts.length - 1]).toBe('All 6 pending cards are flagged for an overlap. Approve those one at a time.');
        expect((await saves(page)).length).toBe(0);
    });

    test('the band shows on History too', async ({ page }) => {
        const d = DATA(); d[1].status = 'Approved'; d[1].reviewedBy = 'Damiano'; d[1].reviewedAt = '2026-10-03T10:00:00Z';
        await open(page, d);
        await page.click('.tab-btn[data-tab="history"]');
        await page.waitForSelector('.card[data-sub-id="B"]');
        await expect(band(page, 'B')).toContainText("Overlaps Kosta's 07:00 to 15:30 card");
    });

    test('Edit modal carries the overlap reason, and a server refusal reveals the row', async ({ page }) => {
        await open(page);
        await card(page, 'B').locator('.edit-sub-btn').click();
        await expect(page.locator('#editOverlapRow')).toBeVisible();
        await expect(page.locator('#editOverlapReason')).toHaveValue('split day');
        await page.click('.modal-footer ._ui-cancel, .modal-footer .btn-quiet');
        await page.waitForSelector('#editOverlapRow', { state: 'detached' });

        const MSG = 'You already have an entry for Friday 2 October from 07:00 to 15:30 on Yard Work 4062. This one overlaps it from 14:00 to 15:30. If both are correct, say why and send it again.';
        await page.evaluate((m) => {
            window.__edits = [];
            window.AppData.editSubmissionAsync = function(id, fields) {
                window.__edits.push({ id: id, fields: JSON.parse(JSON.stringify(fields)) });
                if (!fields.overlapReason) return Promise.reject(new Error(m));
                return Promise.resolve(fields);
            };
        }, MSG);
        await card(page, 'C').locator('.edit-sub-btn').click();
        await expect(page.locator('#editOverlapRow')).toBeHidden();
        await page.fill('#editHours', '9');
        await page.fill('#editReason', 'late finish');
        await page.click('.modal-footer ._ui-submit');
        await expect(page.locator('#editErrMsg')).toContainText(MSG);
        await expect(page.locator('#editOverlapRow')).toBeVisible();
        await page.fill('#editOverlapReason', 'two jobs, phone clocked late');
        await page.click('.modal-footer ._ui-submit');
        await page.waitForFunction(() => (window.__edits || []).length === 2);
        const edits = await page.evaluate(() => window.__edits);
        expect(edits[0].fields.overlapReason).toBeUndefined();
        expect(edits[1].fields.overlapReason).toBe('two jobs, phone clocked late');
    });

    test('fits a 390 pixel phone with the bands showing', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await open(page);
        await expect(band(page, 'B')).toBeVisible();
        const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(over).toBeLessThanOrEqual(0);
    });
});
