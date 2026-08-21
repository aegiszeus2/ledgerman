// timeentry-draft.spec.js
// The crew's complaint: "I lose my entry." These tests pin down the guarantees
// that stop that — a draft is keyed to its own DATE, it does not expire during
// the shift, it is mirrored to the server, and a device that refuses to store
// it says so instead of failing silently.
const { test, expect } = require('@playwright/test');

const HARNESS = '/browser-tests/harness.html';

function today() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
           '-' + String(d.getDate()).padStart(2, '0');
}
function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
           '-' + String(d.getDate()).padStart(2, '0');
}

// Open the manual-entry form (the harness starts in clock-in mode).
async function openForm(page) {
    await page.goto(HARNESS);
    await page.evaluate(() => window.renderTimeEntry({ startTime: '07:00', description: '' }));
    await page.waitForSelector('#timeEntryForm');
}

async function typeNotes(page, text) {
    await page.fill('#teDescription', text);
    await page.dispatchEvent('#teDescription', 'input');
    await page.waitForTimeout(900); // past the 600ms debounce
}

test.describe('time entry draft persistence', () => {

    test('a draft is stored under its own date key', async ({ page }) => {
        await openForm(page);
        await typeNotes(page, 'poured footings');

        const keys = await page.evaluate(() =>
            Object.keys(localStorage).filter(k => k.indexOf('ledgeman_timeentry_draft_') === 0));

        expect(keys).toContain('ledgeman_timeentry_draft_w1_proj-1_' + today());
        // The old date-less key must not be written any more.
        expect(keys).not.toContain('ledgeman_timeentry_draft_w1_proj-1');
    });

    test('two dates on one project do not overwrite each other', async ({ page }) => {
        await openForm(page);
        await typeNotes(page, 'day one work');

        // Worker switches the form to a different date and carries on.
        await page.fill('#teDate', daysAgo(1));
        await page.dispatchEvent('#teDate', 'change');
        await page.waitForTimeout(900);
        await typeNotes(page, 'day two work');

        const a = await page.evaluate(d =>
            JSON.parse(localStorage.getItem('ledgeman_timeentry_draft_w1_proj-1_' + d) || 'null'), today());
        const b = await page.evaluate(d =>
            JSON.parse(localStorage.getItem('ledgeman_timeentry_draft_w1_proj-1_' + d) || 'null'), daysAgo(1));

        expect(a).not.toBeNull();
        expect(b).not.toBeNull();
        expect(a.description).toBe('day one work');
        expect(b.description).toBe('day two work');
    });

    test('a draft older than the old 4h/24h window is still restored', async ({ page }) => {
        await page.goto(HARNESS);
        // Seed a draft saved three days ago for today's date. Under the old
        // age-based expiry this was discarded and the worker got a blank form.
        await page.evaluate(d => {
            const stale = new Date();
            stale.setDate(stale.getDate() - 3);
            localStorage.setItem('ledgeman_timeentry_draft_w1_proj-1_' + d, JSON.stringify({
                date: d, startTime: '07:00', endTime: '15:30',
                description: 'still here', expenses: [], equipment: [],
                draftSavedAt: stale.toISOString()
            }));
        }, today());

        await page.evaluate(() => window.renderTimeEntry({ startTime: '07:00' }));
        await page.waitForSelector('#timeEntryForm');

        await expect(page.locator('#teDraftBanner')).toBeVisible();
        expect(await page.inputValue('#teDescription')).toBe('still here');
        expect(await page.inputValue('#teEndTime')).toBe('15:30');
    });

    test('the draft is mirrored to the server', async ({ page }) => {
        await openForm(page);
        await typeNotes(page, 'mirrored to server');

        const saved = await page.evaluate(() => window.__serverDrafts);
        const key = 'proj-1|' + today();
        expect(saved[key]).toBeTruthy();
        expect(saved[key].description).toBe('mirrored to server');
    });

    test('a wiped phone restores the entry from the server', async ({ page }) => {
        await openForm(page);
        await typeNotes(page, 'typed on the old phone');

        // Storage evicted / new device: local gone, server copy intact.
        await page.evaluate(() => {
            Object.keys(localStorage)
                .filter(k => k.indexOf('ledgeman_timeentry_draft_') === 0)
                .forEach(k => localStorage.removeItem(k));
        });

        await page.evaluate(() => window.renderTimeEntry({ startTime: '07:00' }));
        await page.waitForSelector('#timeEntryForm');
        await expect(page.locator('#teDescription')).toHaveValue('typed on the old phone', { timeout: 5000 });
    });

    test('a storage failure is shown on the form, not swallowed', async ({ page }) => {
        await openForm(page);
        await page.evaluate(() => { window.__storageBlocked = true; });
        await typeNotes(page, 'phone storage is full');

        const status = await page.textContent('#teDraftStatus');
        expect(status).toContain('not letting your entry save');

        const toasts = await page.evaluate(() => window.__toasts || []);
        expect(toasts.some(t => /Could not auto-save/.test(t.msg))).toBe(true);
    });

    test('a storage failure still reaches the server', async ({ page }) => {
        await openForm(page);
        await page.evaluate(() => { window.__storageBlocked = true; });
        await typeNotes(page, 'saved despite full storage');

        const saved = await page.evaluate(() => window.__serverDrafts);
        expect(saved['proj-1|' + today()]).toBeTruthy();
        expect(saved['proj-1|' + today()].description).toBe('saved despite full storage');
    });

    test('a successful save is confirmed on the form', async ({ page }) => {
        await openForm(page);
        await typeNotes(page, 'confirm me');
        const status = await page.textContent('#teDraftStatus');
        expect(status).toMatch(/Saved/);
    });

    test('an old date-less draft is migrated, not lost', async ({ page }) => {
        await page.goto(HARNESS);
        await page.evaluate(d => {
            localStorage.setItem('ledgeman_timeentry_draft_w1_proj-1', JSON.stringify({
                date: d, startTime: '06:30', endTime: '', description: 'mid-entry when the update shipped',
                expenses: [], equipment: [], draftSavedAt: new Date().toISOString()
            }));
        }, today());

        await page.evaluate(() => window.renderTimeEntry({ startTime: '06:30' }));
        await page.waitForSelector('#timeEntryForm');

        expect(await page.inputValue('#teDescription')).toBe('mid-entry when the update shipped');
        const legacy = await page.evaluate(() => localStorage.getItem('ledgeman_timeentry_draft_w1_proj-1'));
        expect(legacy === null || legacy === 'null').toBe(true);
    });

    test('discarding clears both the device and the server copy', async ({ page }) => {
        await openForm(page);
        await typeNotes(page, 'to be discarded');
        await page.evaluate(() => window.renderTimeEntry({ startTime: '07:00' }));
        await page.waitForSelector('#teDraftBanner');

        await page.click('#teDraftDiscard');
        await page.waitForTimeout(400);

        const local = await page.evaluate(d =>
            localStorage.getItem('ledgeman_timeentry_draft_w1_proj-1_' + d), today());
        expect(local === null || local === 'null').toBe(true);
        const server = await page.evaluate(() => window.__serverDrafts);
        expect(server['proj-1|' + today()]).toBeFalsy();
    });

    test('no console errors while drafting', async ({ page }) => {
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await openForm(page);
        await typeNotes(page, 'clean run');
        expect(errors).toEqual([]);
    });
});

// The time entry form is the screen the crew uses outdoors on a phone. Any
// change to it gets re-measured at the three real handset widths.
for (const width of [375, 390, 414]) {
    test.describe(`time entry form — mobile ${width}px`, () => {
        test.use({ viewport: { width, height: 720 }, isMobile: true, hasTouch: true });

        test(`no overflow and touch-sized controls at ${width}px`, async ({ page }) => {
            await openForm(page);
            await typeNotes(page, 'measuring the form');

            const overflow = await page.evaluate(() =>
                document.documentElement.scrollWidth - document.documentElement.clientWidth);
            expect(overflow).toBeLessThanOrEqual(0);

            // Every control the worker touches clears the 44px floor, and every
            // input clears 16px so iOS does not zoom the page on tap.
            const bad = await page.evaluate(() => {
                const out = { small: [], tiny: [] };
                document.querySelectorAll('#timeEntryForm input, #timeEntryForm select, #timeEntryForm textarea, #timeEntryForm button')
                    .forEach(el => {
                        const r = el.getBoundingClientRect();
                        if (r.width === 0 && r.height === 0) return; // hidden
                        const cs = getComputedStyle(el);
                        if (r.height < 44) out.small.push((el.id || el.tagName) + ':' + Math.round(r.height));
                        if (parseFloat(cs.fontSize) < 16 && /INPUT|SELECT|TEXTAREA/.test(el.tagName))
                            out.tiny.push((el.id || el.tagName) + ':' + cs.fontSize);
                    });
                return out;
            });
            expect(bad.small).toEqual([]);
            expect(bad.tiny).toEqual([]);

            // The new save-state line must be readable, not clipped.
            await expect(page.locator('#teDraftStatus')).toBeVisible();
            const st = await page.locator('#teDraftStatus').boundingBox();
            expect(st.width).toBeLessThanOrEqual(width);
        });
    });
}
