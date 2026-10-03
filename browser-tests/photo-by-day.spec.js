// photo-by-day.spec.js
// Damiano's ask (3 October): photos attached to a time entry must be sorted and
// visible by individual day. These tests pin that down on the worker form
// (grouped by the EXIF day the photo was taken, oldest first, off-card days
// flagged) and on the worker history (thumbnails under each day's card).
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const HARNESS = '/browser-tests/harness.html';
const FX = (f) => path.join(__dirname, 'fixtures', f);

async function openForm(page, date) {
    await page.goto(HARNESS);
    await page.evaluate(() => window.renderTimeEntry({ startTime: '07:00', description: '' }));
    await page.waitForSelector('#timeEntryForm');
    await page.fill('#teDate', date);
}

async function attach(page, files) {
    await page.setInputFiles('#tePhotoInput', files.map(FX));
}

async function dayGroups(page) {
    return page.$$eval('.photo-day-group', els => els.map(el => ({
        day: el.getAttribute('data-day'),
        mismatch: el.classList.contains('photo-day-mismatch'),
        title: el.querySelector('.photo-day-title').textContent,
        count: el.querySelector('.photo-day-count').textContent,
        note: (el.querySelector('.photo-day-note') || {}).textContent || '',
        times: Array.from(el.querySelectorAll('.photo-time')).map(t => t.textContent),
        photos: el.querySelectorAll('.photo-preview-item').length,
    })));
}

test.describe('time entry photos grouped by day', () => {

    test('a mixed batch sorts into one block per day, oldest first, dated photos in time order', async ({ page }) => {
        await openForm(page, '2026-10-03');
        await attach(page, ['sat_a.jpg', 'fri_a.jpg', 'nodate.jpg', 'fri_b.jpg']);
        await page.waitForFunction(() =>
            document.querySelectorAll('.photo-day-group').length === 3 &&
            document.querySelectorAll('.photo-time').length === 3);

        const g = await dayGroups(page);
        expect(g.map(x => x.day)).toEqual(['2026-10-02', '2026-10-03', 'unknown']);
        expect(g[0].title).toBe('Friday, October 2');
        expect(g[0].count).toBe('2 photos');
        expect(g[0].times).toEqual(['09:30', '14:05']);
        expect(g[1].title).toBe('Saturday, October 3');
        expect(g[1].count).toBe('1 photo');
        expect(g[2].title).toBe('Date not in photo');
        expect(g[2].note).toContain('No date inside the photo');
        expect(g.reduce((n, x) => n + x.photos, 0)).toBe(4);
    });

    test('a day that is not the card date is flagged, and the flag follows the card date', async ({ page }) => {
        await openForm(page, '2026-10-03');
        await attach(page, ['fri_a.jpg', 'sat_a.jpg']);
        await page.waitForFunction(() => document.querySelectorAll('.photo-time').length === 2);

        let g = await dayGroups(page);
        expect(g[0].day).toBe('2026-10-02');
        expect(g[0].mismatch).toBe(true);
        expect(g[0].note).toContain('Saturday, October 3');
        expect(g[1].mismatch).toBe(false);

        await page.fill('#teDate', '2026-10-02');
        await page.dispatchEvent('#teDate', 'change');
        g = await dayGroups(page);
        expect(g[0].mismatch).toBe(false);
        expect(g[1].mismatch).toBe(true);
        expect(g[1].note).toContain('Friday, October 2');
    });

    test('removing a photo removes only that photo and its day block empties out', async ({ page }) => {
        await openForm(page, '2026-10-02');
        await attach(page, ['fri_a.jpg', 'fri_b.jpg', 'sat_a.jpg']);
        await page.waitForFunction(() => document.querySelectorAll('.photo-time').length === 3);

        await page.click('.photo-day-group[data-day="2026-10-03"] .remove-photo');
        let g = await dayGroups(page);
        expect(g.map(x => x.day)).toEqual(['2026-10-02']);
        expect(g[0].count).toBe('2 photos');

        await page.click('.photo-day-group[data-day="2026-10-02"] .remove-photo');
        g = await dayGroups(page);
        expect(g[0].count).toBe('1 photo');
        expect(g[0].times).toEqual(['14:05']);
    });

    test('saving still files every photo under the card date with the entry', async ({ page }) => {
        await openForm(page, '2026-10-03');
        await attach(page, ['fri_a.jpg', 'sat_a.jpg', 'nodate.jpg']);
        await page.waitForFunction(() => document.querySelectorAll('.photo-preview-item').length === 3);
        await page.fill('#teStartTime', '07:00');
        await page.fill('#teEndTime', '15:00');
        await page.fill('#teDescription', 'fence and pergola');
        await page.click('#teSubmitBtn');
        await page.waitForFunction(() => (window.__submissions || []).length === 1);

        const r = await page.evaluate(() => {
            const s = window.__submissions[0];
            const ph = Object.values(window.__photoStore || {});
            return { ids: s.photoIds.length, date: s.date, dates: ph.map(p => p.date), linked: ph.every(p => p.submissionId === s.id) };
        });
        expect(r.ids).toBe(3);
        expect(r.date).toBe('2026-10-03');
        expect(r.dates).toEqual(['2026-10-03', '2026-10-03', '2026-10-03']);
        expect(r.linked).toBe(true);
    });

    test('a photo with no EXIF still attaches (no date block) and the form stays usable', async ({ page }) => {
        await openForm(page, '2026-10-03');
        await attach(page, ['nodate.jpg']);
        await page.waitForSelector('.photo-day-group');
        const g = await dayGroups(page);
        expect(g).toHaveLength(1);
        expect(g[0].day).toBe('unknown');
        expect(g[0].mismatch).toBe(false);
        const toasts = await page.evaluate(() => (window.__toasts || []).filter(t => t.kind === 'error'));
        expect(toasts).toEqual([]);
    });
});

test.describe('history shows photos under each day', () => {

    test('thumbnails render on the card for the day they belong to', async ({ page }) => {
        await page.goto(HARNESS);
        const b64 = fs.readFileSync(FX('fri_a.jpg')).toString('base64');
        await page.evaluate((b64) => {
            const bin = atob(b64); const u8 = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
            const blob = new Blob([u8], { type: 'image/jpeg' });
            window.__photoStore = { p1: { id: 'p1', blob: blob }, p2: { id: 'p2', blob: blob } };
            window.__submissions = [
                { id: 's-fri', workerId: 'w1', projectId: 'proj-1', date: '2026-10-02', hours: 8, status: 'Approved', description: 'friday', photoIds: ['p1', 'p2'] },
                { id: 's-sat', workerId: 'w1', projectId: 'proj-1', date: '2026-10-03', hours: 6, status: 'Pending',  description: 'saturday', photoIds: ['p-missing'] },
                { id: 's-sun', workerId: 'w1', projectId: 'proj-1', date: '2026-10-04', hours: 4, status: 'Pending',  description: 'sunday', photoIds: [] },
            ];
            window.renderHistory();
        }, b64);

        await page.waitForFunction(() => document.querySelectorAll('.photo-thumb-strip[data-sub-id="s-fri"] img').length === 2);
        const strips = await page.$$eval('.photo-thumb-strip', els => els.map(e => ({ id: e.getAttribute('data-sub-id'), n: e.querySelectorAll('img').length })));
        strips.sort((a, b) => a.id < b.id ? -1 : 1);   // history lists newest first; order is not under test here
        expect(strips).toEqual([{ id: 's-fri', n: 2 }, { id: 's-sat', n: 0 }]);
        // Sunday has no photos, so no strip at all.
        expect(await page.$('.photo-thumb-strip[data-sub-id="s-sun"]')).toBeNull();

        // Tapping a thumbnail opens it full size; tapping again closes it.
        await page.click('.photo-thumb-strip[data-sub-id="s-fri"] img');
        await page.waitForSelector('.photo-view-overlay img');
        await page.click('.photo-view-overlay');
        expect(await page.$('.photo-view-overlay')).toBeNull();
    });
});

test.describe('time entry photos grouped by day — mobile', () => {
    test('four photos across three day blocks fit a 375px phone with no sideways scroll', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await openForm(page, '2026-10-03');
        await attach(page, ['sat_a.jpg', 'fri_a.jpg', 'nodate.jpg', 'fri_b.jpg']);
        await page.waitForFunction(() => document.querySelectorAll('.photo-day-group').length === 3 && document.querySelectorAll('.photo-time').length === 3);
        const m = await page.evaluate(() => ({
            overflow: document.documentElement.scrollWidth - window.innerWidth,
            smallTaps: Array.from(document.querySelectorAll('.remove-photo')).filter(b => b.getBoundingClientRect().width < 24).length,
        }));
        expect(m.overflow).toBeLessThanOrEqual(0);
        expect(m.smallTaps).toBe(0);
        await page.locator('#photoPreviewArea').screenshot({ path: 'test-results/photo-by-day-375.png' });
    });
});
