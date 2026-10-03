// admin-edit-photos.spec.js
// Damiano, 3 October: "when editing a timecard there is no option to add photos,
// add an option to add photos". The admin Edit Submission modal (Approvals →
// Edit) now carries a Photos section: the photos already on the card, grouped by
// day like the worker form, an Add Photos button, remove per photo, and the
// photoIds carried through to the admin-edit save.
const { test, expect } = require('@playwright/test');
const path = require('path');

const HARNESS = '/browser-tests/harness-admin.html';
const FX = (f) => path.join(__dirname, 'fixtures', f);
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const SUB = (over) => Object.assign({
    id: 'sub1', workerId: 'w1', workerName: 'Kosta S', projectId: 'p1', date: '2026-10-02',
    status: 'Pending', rateType: 'Hourly', hours: 8, rate: 30, startTime: '07:00', endTime: '15:30',
    description: 'yard clean up', equipmentEntries: [], photoIds: [],
}, over || {});

async function open(page, sub) {
    await page.goto(HARNESS);
    await page.evaluate((s) => window.openEdit(s), sub);
    await page.waitForSelector('.modal-overlay.active #editPhotoDays', { state: 'attached' });
}
async function attach(page, files) { await page.setInputFiles('#editPhotoInput', files.map(FX)); }
async function groups(page) {
    return page.$$eval('#editPhotoDays .photo-day-group', els => els.map(el => ({
        day: el.getAttribute('data-day'),
        mismatch: el.classList.contains('photo-day-mismatch'),
        title: el.querySelector('.photo-day-title').textContent,
        count: el.querySelector('.photo-day-count').textContent,
        note: (el.querySelector('.photo-day-note') || {}).textContent || '',
        ids: Array.from(el.querySelectorAll('.photo-preview-item')).map(i => i.getAttribute('data-photo-id')),
        imgs: el.querySelectorAll('.photo-preview-item img').length,
    })));
}
const calls = (page) => page.evaluate(() => window.__calls);

test.describe('admin Edit Submission: photos', () => {

    test('the Photos section is there with an Add Photos button and a picker that takes several images', async ({ page }) => {
        await open(page, SUB());
        const legends = await page.$$eval('.modal fieldset legend', ls => ls.map(l => l.textContent.trim()));
        expect(legends).toContain('Photos');
        await expect(page.locator('#editPhotoEmpty')).toBeVisible();
        await expect(page.locator('#editPhotoEmpty')).toHaveText('No photos on this entry yet.');
        await expect(page.locator('#editAddPhotosBtn')).toBeVisible();
        const input = page.locator('#editPhotoInput');
        expect(await input.getAttribute('accept')).toBe('image/*');
        expect(await input.getAttribute('multiple')).not.toBeNull();
        expect(await input.getAttribute('capture')).toBeNull();   // capture= blanks the iPhone camera sheet
        // the button drives the hidden input
        const clicked = await page.evaluate(() => new Promise(res => {
            document.querySelector('#editPhotoInput').addEventListener('click', e => { e.preventDefault(); res(true); });
            document.querySelector('#editAddPhotosBtn').click();
            setTimeout(() => res(false), 500);
        }));
        expect(clicked).toBe(true);
    });

    test('photos already on the card show up under the card date, from the phone store or the server', async ({ page }) => {
        await page.goto(HARNESS);
        await page.evaluate((px) => {
            window.__photoStore['phA'] = { id: 'phA', thumbnail: px };
            window.__serverPhotos['phB'] = { blobB64: px.split(',')[1] };
        }, PX);
        await page.evaluate((s) => window.openEdit(s), SUB({ photoIds: ['phA', 'phB'] }));
        await page.waitForFunction(() => document.querySelectorAll('#editPhotoDays .photo-preview-item img').length === 2);
        const g = await groups(page);
        expect(g).toHaveLength(1);
        expect(g[0].day).toBe('2026-10-02');
        expect(g[0].title).toBe('Friday, October 2');
        expect(g[0].count).toBe('2 photos');
        expect(g[0].mismatch).toBe(false);
        expect(g[0].ids).toEqual(['phA', 'phB']);
        await expect(page.locator('#editPhotoEmpty')).toBeHidden();
        const c = await calls(page);
        expect(c.fetch.filter(u => u.endsWith('/api/photos/phB'))).toHaveLength(1);
        expect(c.fetch.filter(u => u.endsWith('/api/photos/phA'))).toHaveLength(0);
    });

    test('new photos sort into one block per day, oldest first; a day off the card date is flagged and the flag follows the date', async ({ page }) => {
        await open(page, SUB({ date: '2026-10-03' }));
        await attach(page, ['sat_a.jpg', 'fri_a.jpg', 'nodate.jpg']);
        await page.waitForFunction(() => 
            document.querySelectorAll('#editPhotoDays .photo-day-group').length === 3 &&
            document.querySelectorAll('#editPhotoDays .photo-time').length === 2);
        let g = await groups(page);
        expect(g.map(x => x.day)).toEqual(['2026-10-02', '2026-10-03', 'unknown']);
        expect(g[0].mismatch).toBe(true);
        expect(g[0].note).toContain('Saturday, October 3');
        expect(g[1].mismatch).toBe(false);
        expect(g[2].title).toBe('Date not in photo');
        expect(g[2].note).toContain('No date inside the photo');

        await page.fill('#editDate', '2026-10-02');
        await page.dispatchEvent('#editDate', 'change');
        g = await groups(page);
        expect(g[0].mismatch).toBe(false);
        expect(g[1].mismatch).toBe(true);
        expect(g[1].note).toContain('Friday, October 2');
    });

    test('removing a photo removes only that one', async ({ page }) => {
        await open(page, SUB({ date: '2026-10-02' }));
        await attach(page, ['fri_a.jpg', 'fri_b.jpg']);
        await page.waitForFunction(() => document.querySelectorAll('#editPhotoDays .photo-time').length === 2);
        const before = (await groups(page))[0].ids;
        await page.click('#editPhotoDays .photo-preview-item[data-photo-id="' + before[0] + '"] .remove-photo');
        const after = await groups(page);
        expect(after).toHaveLength(1);
        expect(after[0].ids).toEqual([before[1]]);
        expect(after[0].count).toBe('1 photo');
    });

    test('saving stores the new photos against this entry and sends the full photo list with the edit', async ({ page }) => {
        await open(page, SUB({ photoIds: ['phOld'] }));
        await attach(page, ['fri_a.jpg', 'fri_b.jpg']);
        await page.waitForFunction(() => document.querySelectorAll('#editPhotoDays .photo-time').length === 2);
        await page.fill('#editReason', 'added the site photos');
        await page.click('.modal-footer ._ui-submit');
        await page.waitForFunction(() => window.__calls.editSubmission.length === 1);
        const c = await calls(page);
        expect(c.savePhoto).toHaveLength(2);
        for (const p of c.savePhoto) {
            expect(p.submissionId).toBe('sub1');
            expect(p.projectId).toBe('p1');
            expect(p.workerId).toBe('w1');
            expect(p.workerName).toBe('Kosta S');
            expect(p.date).toBe('2026-10-02');
            expect(p.filename).toMatch(/fri_[ab]\.jpg/);
        }
        const e = c.editSubmission[0];
        expect(e.id).toBe('sub1');
        expect(e.reason).toBe('added the site photos');
        expect(e.fields.photoIds).toEqual(['phOld', c.savePhoto[0].id, c.savePhoto[1].id]);
        expect(e.fields.hours).toBe(8);
        expect(e.fields.projectId).toBe('p1');
        expect(c.deletePhoto).toEqual([]);
        await expect(page.locator('.modal-overlay.active')).toHaveCount(0);
    });

    test('taking a photo off the card drops it from the list and deletes it after the save goes through', async ({ page }) => {
        await open(page, SUB({ photoIds: ['phA', 'phB'] }));
        await page.click('#editPhotoDays .photo-preview-item[data-photo-id="phA"] .remove-photo');
        await page.click('.modal-footer ._ui-submit');
        await page.waitForFunction(() => window.__calls.editSubmission.length === 1);
        const c = await calls(page);
        expect(c.editSubmission[0].fields.photoIds).toEqual(['phB']);
        expect(c.deletePhoto).toEqual(['phA']);
        expect(c.savePhoto).toHaveLength(0);
    });

    test('an edit that does not touch the photos does not send photoIds at all', async ({ page }) => {
        await open(page, SUB({ photoIds: ['phA'] }));
        await page.fill('#editHours', '9');
        await page.click('.modal-footer ._ui-submit');
        await page.waitForFunction(() => window.__calls.editSubmission.length === 1);
        const c = await calls(page);
        expect('photoIds' in c.editSubmission[0].fields).toBe(false);
        expect(c.editSubmission[0].fields.hours).toBe(9);
        expect(c.deletePhoto).toEqual([]);
    });

    test('if the save fails nothing is deleted and the modal stays open with the error', async ({ page }) => {
        await open(page, SUB({ photoIds: ['phA', 'phB'] }));
        await page.evaluate(() => { window.__failEdit = 'server said no'; });
        await page.click('#editPhotoDays .photo-preview-item[data-photo-id="phA"] .remove-photo');
        await page.click('.modal-footer ._ui-submit');
        await page.waitForFunction(() => window.__calls.editSubmission.length === 1);
        await expect(page.locator('#editErrMsg')).toContainText('server said no');
        await expect(page.locator('.modal-overlay.active')).toHaveCount(1);
        expect((await calls(page)).deletePhoto).toEqual([]);
    });

    test('Add Timecard (create mode) carries its photos too, linked to the new card id', async ({ page }) => {
        await open(page, null);
        await page.selectOption('#editWorkerId', 'w1');
        await page.selectOption('#editProjectId', 'p2');
        await page.fill('#editDate', '2026-10-02');
        await page.fill('#editHours', '6');
        await attach(page, ['sat_a.jpg']);
        await page.waitForFunction(() => document.querySelectorAll('#editPhotoDays .photo-preview-item').length === 1);
        await page.click('.modal-footer ._ui-submit');
        await page.waitForFunction(() => window.__calls.saveSubmission.length === 1);
        const c = await calls(page);
        const s = c.saveSubmission[0];
        expect(c.savePhoto).toHaveLength(1);
        expect(c.savePhoto[0].submissionId).toBe(s.id);
        expect(c.savePhoto[0].projectId).toBe('p2');
        expect(c.savePhoto[0].workerId).toBe('w1');
        expect(s.photoIds).toEqual([c.savePhoto[0].id]);
        expect(s.entryMethod).toBe('Admin Entry');
    });

    test('tapping a thumbnail opens it full size', async ({ page }) => {
        await open(page, SUB());
        await attach(page, ['fri_a.jpg']);
        await page.waitForFunction(() => document.querySelectorAll('#editPhotoDays .photo-preview-item img').length === 1);
        await page.click('#editPhotoDays .photo-preview-item img');
        await expect(page.locator('.modal-overlay.active')).toHaveCount(2);
        const src = await page.$eval('.modal-overlay.active:last-of-type .modal-body img', i => i.getAttribute('src'));
        expect(/^(data:image\/|blob:)/.test(src)).toBe(true);   // new photo = full file as blob URL, stored photo = data URL
    });
});

test.describe('admin Edit Submission: photos on a phone', () => {
    test.use({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });
    test('the Photos section fits a 375 pixel phone with no sideways scroll', async ({ page }) => {
        await open(page, SUB({ date: '2026-10-03' }));
        await attach(page, ['fri_a.jpg', 'sat_a.jpg', 'nodate.jpg']);
        await page.waitForFunction(() => document.querySelectorAll('#editPhotoDays .photo-preview-item').length === 3);
        const m = await page.evaluate(() => {
            const modal = document.querySelector('.modal');
            const r = modal.getBoundingClientRect();
            return { right: r.right, docW: document.documentElement.scrollWidth, modalScrollW: modal.scrollWidth, modalW: modal.clientWidth };
        });
        expect(m.right).toBeLessThanOrEqual(375);
        expect(m.docW).toBeLessThanOrEqual(375);
        expect(m.modalScrollW).toBeLessThanOrEqual(m.modalW + 1);
        await page.locator('#editAddPhotosBtn').scrollIntoViewIfNeeded();
        await expect(page.locator('#editAddPhotosBtn')).toBeVisible();
        await page.screenshot({ path: 'test-results/admin-edit-photos-375.png' });
    });
});
