// data-cache.spec.js
// After an admin edit the Approvals screen and a reopened Edit modal must show
// the edited card, not the pre-edit one. editSubmissionAsync used to write only
// localStorage, leaving the in-memory cache (what getSubmission reads once the
// app has synced) stale until the next full sync. Found 2026-10-03.
const { test, expect } = require('@playwright/test');
const HARNESS = '/browser-tests/harness-data.html';

test('editSubmissionAsync updates what getSubmission and getSubmissions return after a sync', async ({ page }) => {
    await page.goto(HARNESS);
    await page.evaluate(() => {
        window.__server.submissions = [
            { id: 'sub1', workerId: 'w1', projectId: 'p1', date: '2026-10-02', hours: 8, status: 'Pending', photoIds: ['phA'] },
            { id: 'sub2', workerId: 'w2', projectId: 'p1', date: '2026-10-02', hours: 4, status: 'Pending' },
        ];
    });
    await page.evaluate(() => AppData.syncFromServer());
    expect(await page.evaluate(() => AppData.getSubmission('sub1').photoIds)).toEqual(['phA']);

    await page.evaluate(() => AppData.editSubmissionAsync('sub1', { hours: 9, photoIds: ['phA', 'phB'] }, 'added a photo', false));

    const after = await page.evaluate(() => ({
        one: AppData.getSubmission('sub1'),
        all: AppData.getSubmissions().map(s => [s.id, s.hours]),
        stored: JSON.parse(localStorage.getItem('ledgeman_submissions')).filter(s => s.id === 'sub1')[0],
    }));
    expect(after.one.hours).toBe(9);
    expect(after.one.photoIds).toEqual(['phA', 'phB']);
    expect(after.one.editHistory).toHaveLength(1);
    expect(after.all).toEqual([['sub1', 9], ['sub2', 4]]);
    expect(after.stored.hours).toBe(9);           // localStorage mirror kept in step too
    const patch = await page.evaluate(() => window.__calls.filter(c => c.method === 'PATCH')[0]);
    expect(JSON.parse(patch.body)).toEqual({ hours: 9, photoIds: ['phA', 'phB'], reason: 'added a photo', requireReApproval: false });
});

test('before any sync (offline/localStorage mode) the edit still lands in localStorage', async ({ page }) => {
    await page.goto(HARNESS);
    await page.evaluate(() => {
        localStorage.setItem('ledgeman_submissions', JSON.stringify([{ id: 'sub1', hours: 8, status: 'Pending' }]));
        window.__server.submissions = [{ id: 'sub1', hours: 8, status: 'Pending' }];
    });
    await page.evaluate(() => AppData.editSubmissionAsync('sub1', { hours: 7 }, '', false));
    expect(await page.evaluate(() => AppData.getSubmission('sub1').hours)).toBe(7);
});
