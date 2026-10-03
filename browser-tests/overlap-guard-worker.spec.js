// overlap-guard-worker.spec.js
// Damiano, 3 October: two entries for the same day with overlapping hours went through
// unflagged. On the worker form: an overlap with another card for the day is named in
// plain words and needs a tick plus a reason; an exact duplicate is blocked outright;
// a server refusal is shown and leaves no ghost copy on the phone.
const { test, expect } = require('@playwright/test');

const HARNESS = '/browser-tests/harness.html';
const CARD = (over) => Object.assign({ id: 'c1', workerId: 'w1', projectId: 'proj-1', date: '2026-10-02',
    startTime: '07:00', endTime: '15:30', hours: 8.5, status: 'Pending' }, over || {});

async function openForm(page, subs, date) {
    await page.goto(HARNESS);
    await page.evaluate((s) => { window.__submissions = s; window.__toasts = []; }, subs);
    await page.evaluate(() => window.renderTimeEntry({ startTime: '07:00', description: '' }));
    await page.waitForSelector('#timeEntryForm');
    await page.fill('#teDate', date || '2026-10-02');
    await page.fill('#teDescription', 'yard work');
}
const setTimes = async (page, st, en) => { await page.fill('#teStartTime', st); await page.fill('#teEndTime', en); };
const submit = (page) => page.click('#teSubmitBtn');
const warn = (page) => page.locator('#teOverlapWarn');
const saved = (page) => page.evaluate(() => window.__submissions || []);

test.describe('worker form overlap guard', () => {

    test('an overlap is named, blocked until ticked with a reason, then saved carrying the reason', async ({ page }) => {
        await openForm(page, [CARD()]);
        await setTimes(page, '12:00', '18:00');
        await submit(page);
        await expect(warn(page)).toBeVisible();
        expect(await warn(page).getAttribute('data-kind')).toBe('overlap');
        await expect(page.locator('#teOverlapMsg')).toContainText('You already have an entry for Friday 2 October from 07:00 to 15:30 on Test Project. This one overlaps it from 12:00 to 15:30.');
        await expect(page.locator('#teOverlapOverride')).toBeVisible();
        expect((await saved(page)).length).toBe(1);

        await page.check('#teOverlapOk');
        await submit(page);                                   // ticked but no reason: still held
        expect((await saved(page)).length).toBe(1);
        await page.fill('#teOverlapReason', 'second job, first card closed late');
        await submit(page);
        await page.waitForFunction(() => (window.__submissions || []).length === 2);
        const last = (await saved(page))[1];
        expect(last.startTime).toBe('12:00');
        expect(last.overlapReason).toBe('second job, first card closed late');
    });

    test('an exact duplicate is blocked outright, no override offered', async ({ page }) => {
        await openForm(page, [CARD()]);
        await setTimes(page, '07:00', '15:30');
        await submit(page);
        await expect(warn(page)).toBeVisible();
        expect(await warn(page).getAttribute('data-kind')).toBe('duplicate');
        await expect(page.locator('#teOverlapMsg')).toContainText('This entry is already in: Friday 2 October, 07:00 to 15:30 on Test Project. A second copy of the same card is not allowed.');
        await expect(page.locator('#teOverlapOverride')).toBeHidden();
        // even a forced tick and reason do not get it through
        await page.evaluate(() => { document.querySelector('#teOverlapOk').checked = true; document.querySelector('#teOverlapReason').value = 'forced'; });
        await submit(page);
        expect((await saved(page)).length).toBe(1);
    });

    test('two minutes is touching, not overlapping: saved with no warning', async ({ page }) => {
        await openForm(page, [CARD({ startTime: '07:56', endTime: '14:54', hours: 7 })]);
        await setTimes(page, '14:52', '17:31');
        await submit(page);
        await page.waitForFunction(() => (window.__submissions || []).length === 2);
        await expect(warn(page)).toBeHidden();
        expect((await saved(page))[1].overlapReason).toBe('');
    });

    test('a rejected card and a card on another day do not count', async ({ page }) => {
        await openForm(page, [CARD({ status: 'Rejected' }), CARD({ id: 'c2', date: '2026-10-01' })]);
        await setTimes(page, '07:00', '15:30');
        await submit(page);
        await page.waitForFunction(() => (window.__submissions || []).length === 3);
        await expect(warn(page)).toBeHidden();
    });

    test('changing the times clears the warning', async ({ page }) => {
        await openForm(page, [CARD()]);
        await setTimes(page, '12:00', '18:00');
        await submit(page);
        await expect(warn(page)).toBeVisible();
        await page.fill('#teStartTime', '15:30');
        await expect(warn(page)).toBeHidden();
        await submit(page);
        await page.waitForFunction(() => (window.__submissions || []).length === 2);
    });

    test('a server refusal is shown in the warning and leaves no ghost copy', async ({ page }) => {
        await openForm(page, []);
        const MSG = 'You already have an entry for Friday 2 October from 07:00 to 15:30 on Yard Work. This one overlaps it from 07:00 to 12:00. If both are correct, say why and send it again.';
        await page.evaluate((m) => {
            window.__asyncSaves = [];
            window.AppData.saveEntityAsync = function() { return Promise.reject(new Error(m)); };
        }, MSG);
        await setTimes(page, '07:00', '12:00');
        await submit(page);
        await expect(warn(page)).toBeVisible();
        expect(await warn(page).getAttribute('data-kind')).toBe('overlap');
        await expect(page.locator('#teOverlapMsg')).toContainText(MSG);
        expect((await saved(page)).length).toBe(0);            // no fire-and-forget copy
        await expect(page.locator('#teSubmitBtn')).toBeEnabled();
        await expect(page.locator('#teSubmitBtn')).toContainText('Submit for Approval');
        const toasts = await page.evaluate(() => window.__toasts);
        expect(toasts[toasts.length - 1].msg).toBe(MSG);

        // the server accepts it once the reason travels with the card
        await page.evaluate(() => {
            window.AppData.saveEntityAsync = function(entity, item) { window.__asyncSaves.push(item); return Promise.resolve(item); };
        });
        await page.check('#teOverlapOk');
        await page.fill('#teOverlapReason', 'other phone logged the first half');
        await submit(page);
        await page.waitForFunction(() => (window.__asyncSaves || []).length === 1);
        const item = (await page.evaluate(() => window.__asyncSaves))[0];
        expect(item.overlapReason).toBe('other phone logged the first half');
        expect(item.startTime).toBe('07:00');
    });

    test('the warning fits a 375 pixel phone', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await openForm(page, [CARD()]);
        await setTimes(page, '12:00', '18:00');
        await submit(page);
        await expect(warn(page)).toBeVisible();
        const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(over).toBeLessThanOrEqual(0);
    });
});
