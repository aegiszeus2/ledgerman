// receipt-scan.spec.js
// Scan a receipt on the admin Add Expense form (Material and Equipment only). The photo is
// downscaled on the phone, posted to /api/photos, read by /api/photos/<id>/extract, and the
// empty fields fill in (vendor, date, amount, description). Nothing the user typed is
// overwritten. When reading is switched off (503) or fails, the photo is kept and attached
// to the expense on save all the same (attach-expense). Harness, no network.
const { test, expect } = require('@playwright/test');
const path = require('path');

const HARNESS = '/browser-tests/harness-expenses.html';
const FX = (f) => path.join(__dirname, 'fixtures', f);

async function open(page, type) {
    await page.goto(HARNESS);
    await page.evaluate((t) => window.openForm(t), type || 'Material');
    await page.waitForSelector('.modal-overlay.active #expenseFormModal', { state: 'attached' });
}
async function scan(page, file) {
    await page.setInputFiles('#receiptFileInput', FX(file || 'fri_a.jpg'));
}
async function waitForStatus(page, re) {
    await page.waitForFunction((src) => new RegExp(src).test(document.querySelector('#receiptStatus').textContent), re.source);
}
const calls = (page) => page.evaluate(() => window.__calls.fetch);
const todayInPage = (page) => page.evaluate(() => Utils.today());
const val = (page, sel) => page.$eval(sel, (el) => el.value);
// A 3000 by 2000 PNG made in the page itself, to prove the downscale (Node has no image library here).
async function bigImageBuffer(page) {
    const b64 = await page.evaluate(() => {
        const c = document.createElement('canvas'); c.width = 3000; c.height = 2000;
        const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 3000, 2000);
        ctx.fillStyle = '#000'; ctx.font = '80px sans-serif'; ctx.fillText('HOME DEPOT 45.67', 100, 300);
        return c.toDataURL('image/png').split(',')[1];
    });
    return Buffer.from(b64, 'base64');
}
async function decodedSize(page, dataUrl) {
    return page.evaluate((src) => new Promise((res) => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight }); i.src = src; }), dataUrl);
}

test.describe('Add Expense: scan a receipt', () => {

    test('Material and Equipment get a Scan receipt button that drives a hidden image picker; Labor does not', async ({ page }) => {
        for (const type of ['Material', 'Equipment']) {
            await open(page, type);
            await expect(page.locator('#receiptScanBtn')).toBeVisible();
            await expect(page.locator('#receiptScanBtn')).toHaveText('Scan receipt');
            const input = page.locator('#receiptFileInput');
            expect(await input.getAttribute('type')).toBe('file');
            expect(await input.getAttribute('accept')).toBe('image/*');
            await expect(input).toBeHidden();
            await expect(page.locator('#receiptStatus')).toHaveText('Take a photo of the receipt and the fields below fill in for you.');
            await expect(page.locator('#receiptRawWrap')).toBeHidden();
            const clicked = await page.evaluate(() => new Promise((res) => {
                document.querySelector('#receiptFileInput').addEventListener('click', (e) => { e.preventDefault(); res(true); });
                document.querySelector('#receiptScanBtn').click();
                setTimeout(() => res(false), 500);
            }));
            expect(clicked).toBe(true);
            // the receipt block sits at the top of the form, before Description
            const first = await page.$eval('#expenseFormModal', (f) => f.firstElementChild.id);
            expect(first).toBe('receiptScanBlock');
        }
        await open(page, 'Labor');
        await expect(page.locator('#receiptScanBtn')).toHaveCount(0);
        await expect(page.locator('#receiptFileInput')).toHaveCount(0);
    });

    test('choosing a photo posts it to /api/photos on the chosen project, then extract fills the empty fields', async ({ page }) => {
        await open(page, 'Material');
        await scan(page, 'fri_a.jpg');
        await waitForStatus(page, /Check these fields before you save/);
        const c = await calls(page);
        const photoPost = c.filter((x) => /\/api\/photos$/.test(x.url) && x.method === 'POST');
        expect(photoPost).toHaveLength(1);
        const p = photoPost[0].body;
        expect(p.projectId).toBe('p1');
        expect(p.date).toBe(await todayInPage(page));
        expect(p.filename).toBe('fri_a.jpg');
        expect(p.blobB64).toMatch(/^data:image\/jpeg;base64,/);
        expect(p.thumbnailB64).toMatch(/^data:image\/jpeg;base64,/);
        expect(photoPost[0].url).toBe('http://api.test/api/photos');
        const extract = c.filter((x) => /\/extract$/.test(x.url));
        expect(extract).toHaveLength(1);
        expect(extract[0].url).toBe('http://api.test/api/photos/' + p.id + '/extract');
        expect(extract[0].method).toBe('POST');
        // extract came after the photo post
        expect(c.indexOf(extract[0])).toBeGreaterThan(c.indexOf(photoPost[0]));

        expect(await val(page, '[name="vendorSelect"]')).toBe('v1');           // Home Depot matched by name
        await expect(page.locator('#vendorManualGroup')).toBeHidden();
        expect(await val(page, '[name="date"]')).toBe('2026-10-14');
        expect(await val(page, '[name="amount"]')).toBe('45.67');
        expect(await val(page, '[name="description"]')).toBe('2x4 lumber, Deck screws');
        await expect(page.locator('#receiptStatus')).toHaveText('Check these fields before you save. Read with high confidence.');
        await expect(page.locator('#receiptThumb')).toBeVisible();
        expect(await page.$eval('#receiptThumb', (i) => i.getAttribute('src'))).toBe(p.thumbnailB64);
        // raw text is there, collapsed
        await expect(page.locator('#receiptRawWrap')).toBeVisible();
        expect(await page.$eval('#receiptRawWrap', (d) => d.open)).toBe(false);
        await expect(page.locator('#receiptRawWrap summary')).toHaveText('Text read from the receipt');
        await expect(page.locator('#receiptRawText')).toContainText('DECK SCREWS 15.50');
        await page.click('#receiptRawWrap summary');
        expect(await page.$eval('#receiptRawWrap', (d) => d.open)).toBe(true);
        // no delete, no attach yet (nothing saved)
        expect(c.filter((x) => x.method === 'DELETE')).toHaveLength(0);
        expect(c.filter((x) => /attach-expense$/.test(x.url))).toHaveLength(0);
    });

    test('the photo is downscaled to 1600 px on the long edge as JPEG, with a 200 px thumbnail', async ({ page }) => {
        await open(page, 'Equipment');
        const buffer = await bigImageBuffer(page);
        await page.setInputFiles('#receiptFileInput', { name: 'IMG_0042.PNG', mimeType: 'image/png', buffer });
        await waitForStatus(page, /Check these fields before you save/);
        const c = await calls(page);
        const p = c.filter((x) => /\/api\/photos$/.test(x.url))[0].body;
        expect(p.filename).toBe('IMG_0042.PNG');
        expect(p.blobB64).toMatch(/^data:image\/jpeg;base64,/);
        expect(await decodedSize(page, p.blobB64)).toEqual({ w: 1600, h: 1067 });
        expect(await decodedSize(page, p.thumbnailB64)).toEqual({ w: 200, h: 133 });
        // small enough to post: well under the raw PNG
        expect(p.blobB64.length).toBeLessThan(buffer.length);
    });

    test('a file with no name gets receipt-<timestamp>.jpg', async ({ page }) => {
        await open(page, 'Material');
        const buffer = Buffer.from(await page.evaluate(() => {
            const c = document.createElement('canvas'); c.width = 40; c.height = 30;
            return c.toDataURL('image/jpeg').split(',')[1];
        }), 'base64');
        await page.setInputFiles('#receiptFileInput', { name: '', mimeType: 'image/jpeg', buffer });
        await waitForStatus(page, /Check these fields before you save/);
        const p = (await calls(page)).filter((x) => /\/api\/photos$/.test(x.url))[0].body;
        expect(p.filename).toMatch(/^receipt-\d{8}-\d{6}\.jpg$/);
    });

    test('a field the user already typed into is left alone; only empty fields are filled', async ({ page }) => {
        await open(page, 'Material');
        await page.fill('[name="description"]', 'Deck boards for the back porch');
        await page.fill('[name="amount"]', '120');
        await page.fill('[name="date"]', '2026-10-01');
        await scan(page, 'fri_a.jpg');
        await waitForStatus(page, /Check these fields before you save/);
        expect(await val(page, '[name="description"]')).toBe('Deck boards for the back porch');
        expect(await val(page, '[name="amount"]')).toBe('120');
        expect(await val(page, '[name="date"]')).toBe('2026-10-01');
        expect(await val(page, '[name="vendorSelect"]')).toBe('v1');   // vendor was empty, so it filled
    });

    test('the default date (today) counts as empty and is replaced by the receipt date; a vendor the user picked stays', async ({ page }) => {
        await open(page, 'Material');
        expect(await val(page, '[name="date"]')).toBe(await todayInPage(page));
        await page.selectOption('[name="vendorSelect"]', 'v2');
        await scan(page, 'fri_a.jpg');
        await waitForStatus(page, /Check these fields before you save/);
        expect(await val(page, '[name="date"]')).toBe('2026-10-14');
        expect(await val(page, '[name="vendorSelect"]')).toBe('v2');
    });

    test('vendor match is case insensitive; a vendor not in the list goes to Type manually with the name filled in', async ({ page }) => {
        await open(page, 'Material');
        await page.evaluate(() => { window.__mock.extract = Object.assign({}, window.__mock.extract, { vendor: '  RONA ' }); });
        await scan(page, 'fri_a.jpg');
        await waitForStatus(page, /Check these fields before you save/);
        expect(await val(page, '[name="vendorSelect"]')).toBe('v2');
        await expect(page.locator('#vendorManualGroup')).toBeHidden();

        await open(page, 'Material');
        await page.evaluate(() => { window.__mock.extract = Object.assign({}, window.__mock.extract, { vendor: "Joe's Lumber Yard", line_items: [] }); });
        await scan(page, 'fri_a.jpg');
        await waitForStatus(page, /Check these fields before you save/);
        expect(await val(page, '[name="vendorSelect"]')).toBe('__manual__');
        await expect(page.locator('#vendorManualGroup')).toBeVisible();
        expect(await val(page, '[name="vendorManual"]')).toBe("Joe's Lumber Yard");
        // no line items: description falls back to "<vendor> receipt"
        expect(await val(page, '[name="description"]')).toBe("Joe's Lumber Yard receipt");
    });

    test('confidence reads as plain words: medium, low, or nothing when the server gives none; a bad date or amount is skipped', async ({ page }) => {
        await open(page, 'Material');
        await page.evaluate(() => { window.__mock.extract = Object.assign({}, window.__mock.extract, { confidence: 0.6, date: 'October 14', amount: null }); });
        await scan(page, 'fri_a.jpg');
        await waitForStatus(page, /Check these fields before you save/);
        await expect(page.locator('#receiptStatus')).toHaveText('Check these fields before you save. Read with medium confidence.');
        expect(await val(page, '[name="date"]')).toBe(await todayInPage(page));
        expect(await val(page, '[name="amount"]')).toBe('');

        await open(page, 'Material');
        await page.evaluate(() => { window.__mock.extract = Object.assign({}, window.__mock.extract, { confidence: 0.2, amount: '12.5' }); });
        await scan(page, 'fri_a.jpg');
        await waitForStatus(page, /Check these fields before you save/);
        await expect(page.locator('#receiptStatus')).toHaveText('Check these fields before you save. Read with low confidence.');
        expect(await val(page, '[name="amount"]')).toBe('12.50');

        await open(page, 'Material');
        await page.evaluate(() => { window.__mock.extract = Object.assign({}, window.__mock.extract, { confidence: null, raw_text: '' }); });
        await scan(page, 'fri_a.jpg');
        await waitForStatus(page, /Check these fields before you save/);
        await expect(page.locator('#receiptStatus')).toHaveText('Check these fields before you save.');
        await expect(page.locator('#receiptRawWrap')).toBeHidden();
    });

    test('when reading is switched off (503) it says so in plain words, keeps the photo, and still attaches it on save', async ({ page }) => {
        await open(page, 'Material');
        await page.evaluate(() => { window.__mock.extractStatus = 503; });
        await scan(page, 'fri_a.jpg');
        await waitForStatus(page, /switched off/);
        await expect(page.locator('#receiptStatus')).toHaveText('Receipt reading is switched off right now. Fill the fields by hand, the photo will still be attached when you save.');
        await expect(page.locator('#receiptThumb')).toBeVisible();
        expect(await val(page, '[name="description"]')).toBe('');
        expect(await val(page, '[name="vendorSelect"]')).toBe('');
        await expect(page.locator('#receiptScanBtn')).toBeEnabled();
        const photoId = (await calls(page)).filter((x) => /\/api\/photos$/.test(x.url))[0].body.id;

        await page.fill('[name="description"]', 'Gravel');
        await page.fill('[name="amount"]', '88');
        await page.click('.modal-footer ._ui-submit');
        await page.waitForFunction(() => window.__calls.fetch.some((x) => /attach-expense$/.test(x.url)));
        const c = await calls(page);
        const saved = c.filter((x) => /\/api\/expenses$/.test(x.url))[0];
        const attach = c.filter((x) => /attach-expense$/.test(x.url))[0];
        expect(attach.url).toBe('http://api.test/api/photos/' + photoId + '/attach-expense');
        expect(attach.body).toEqual({ expense_id: saved.body.id });
        await expect(page.locator('.modal-overlay.active')).toHaveCount(0);
    });

    test('any other extract error shows the server text and keeps the photo', async ({ page }) => {
        await open(page, 'Material');
        await page.evaluate(() => { window.__mock.extractStatus = 500; window.__mock.extractError = 'Model returned no text for this image'; });
        await scan(page, 'fri_a.jpg');
        await waitForStatus(page, /Could not read the receipt/);
        await expect(page.locator('#receiptStatus')).toHaveText('Could not read the receipt: Model returned no text for this image. Fill the fields by hand, the photo will still be attached when you save.');
        await expect(page.locator('#receiptThumb')).toBeVisible();
        expect((await calls(page)).filter((x) => x.method === 'DELETE')).toHaveLength(0);
    });

    test('if the photo itself cannot be saved, extract is not called and the status says why', async ({ page }) => {
        await open(page, 'Material');
        await page.evaluate(() => { window.__mock.photoStatus = 500; });
        await scan(page, 'fri_a.jpg');
        await waitForStatus(page, /Could not save the photo/);
        await expect(page.locator('#receiptStatus')).toContainText('Photo store is full');
        const c = await calls(page);
        expect(c.filter((x) => /\/extract$/.test(x.url))).toHaveLength(0);
        // saving the expense then fires no attach, since there is no photo on the server
        await page.fill('[name="description"]', 'Gravel');
        await page.fill('[name="amount"]', '88');
        await page.click('.modal-footer ._ui-submit');
        await page.waitForFunction(() => window.__calls.fetch.some((x) => /\/api\/expenses$/.test(x.url)));
        await expect(page.locator('.modal-overlay.active')).toHaveCount(0);
        expect((await calls(page)).filter((x) => /attach-expense$/.test(x.url))).toHaveLength(0);
    });

    test('after a good scan, saving posts the expense first and then attach-expense with the photo id and the new expense id', async ({ page }) => {
        await open(page, 'Equipment');
        await scan(page, 'fri_a.jpg');
        await waitForStatus(page, /Check these fields before you save/);
        const photoId = (await calls(page)).filter((x) => /\/api\/photos$/.test(x.url))[0].body.id;
        await page.click('.modal-footer ._ui-submit');
        await page.waitForFunction(() => window.__calls.fetch.some((x) => /attach-expense$/.test(x.url)));
        const c = await calls(page);
        const saved = c.filter((x) => /\/api\/expenses$/.test(x.url));
        const attach = c.filter((x) => /attach-expense$/.test(x.url));
        expect(saved).toHaveLength(1);
        expect(attach).toHaveLength(1);
        expect(c.indexOf(attach[0])).toBeGreaterThan(c.indexOf(saved[0]));
        expect(saved[0].body.category).toBe('Equipment');
        expect(saved[0].body.projectId).toBe('p1');
        expect(saved[0].body.amount).toBe(45.67);
        expect(saved[0].body.date).toBe('2026-10-14');
        expect(saved[0].body.vendorId).toBe('v1');
        expect(saved[0].body.vendorName).toBe('Home Depot');
        expect(saved[0].body.description).toBe('2x4 lumber, Deck screws');
        expect(attach[0].url).toBe('http://api.test/api/photos/' + photoId + '/attach-expense');
        expect(attach[0].body).toEqual({ expense_id: saved[0].body.id });
        await expect(page.locator('.modal-overlay.active')).toHaveCount(0);
    });

    test('if the save fails, no attach is sent and the form stays open; cancelling leaves the photo as it is', async ({ page }) => {
        await open(page, 'Material');
        await scan(page, 'fri_a.jpg');
        await waitForStatus(page, /Check these fields before you save/);
        await page.evaluate(() => { window.__mock.expenseStatus = 500; });
        await page.click('.modal-footer ._ui-submit');
        await page.waitForFunction(() => window.__calls.fetch.some((x) => /\/api\/expenses$/.test(x.url)));
        await expect(page.locator('.modal-overlay.active')).toHaveCount(1);
        let c = await calls(page);
        expect(c.filter((x) => /attach-expense$/.test(x.url))).toHaveLength(0);
        await page.click('.modal-footer ._ui-cancel');
        await expect(page.locator('.modal-overlay.active')).toHaveCount(0);
        c = await calls(page);
        expect(c.filter((x) => x.method === 'DELETE')).toHaveLength(0);
        expect(c.filter((x) => /attach-expense$/.test(x.url))).toHaveLength(0);
    });

    test('the form with a scanned receipt fits a 390 pixel phone with no sideways scroll', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await open(page, 'Material');
        await page.evaluate(() => { window.__mock.extract = Object.assign({}, window.__mock.extract, {
            vendor: 'A Very Long Vendor Name That Goes On And On Supply Company Limited',
            raw_text: 'AVERYLONGLINEOFTEXTWITHNOSPACESTHATCOULDPUSHTHEPAGEWIDEROPENIFITWERENOTWRAPPEDPROPERLY 1234567890 1234567890' }); });
        await scan(page, 'fri_a.jpg');
        await waitForStatus(page, /Check these fields before you save/);
        await page.click('#receiptRawWrap summary');
        const w = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
        expect(w.scroll).toBeLessThanOrEqual(390);
        expect(w.scroll - w.client).toBeLessThanOrEqual(0);
        const block = await page.$eval('#receiptScanBlock', (el) => el.getBoundingClientRect().right);
        expect(block).toBeLessThanOrEqual(390);
        await expect(page.locator('#receiptScanBtn')).toBeVisible();
        await expect(page.locator('#receiptThumb')).toBeVisible();
    });
});
