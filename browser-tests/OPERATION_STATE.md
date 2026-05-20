# OPERATION_STATE.md
## Mobile Regression Test Suite — Ledgerman

---

## APPROVAL STATUS
**APPROVED AND COMPLETE — 2026-05-19**

## CURRENT PHASE
Phase 12 — Complete. CI workflow committed. Tests run 21/21 pass locally and will enforce on every push/PR.

## CURRENT SAFE NEXT ACTION
Push to GitHub (`git push origin main`). GitHub Actions will run the workflow automatically on the next push.
To enable merge blocking: add a branch protection rule on `main` requiring "Mobile Regression Tests / mobile-tests" to pass.

## DO NOT DO
- Modify any existing app source files
- Change any backend, database, or deployment configuration
- Modify authentication or tenant logic
- Deploy anything

---

## OBJECTIVE
Add automated mobile regression testing to prevent Ledgerman from re-breaking on mobile.
- Playwright-based
- Tests at 375px, 390px, 414px
- Pages: admin dashboard, worker portal, invoice modal, contracts, budget tracking, AI assistant
- Validation: viewport overflow, touch targets, overflow:hidden roots, modal fit, scroll availability
- Output: screenshots per test, diagnostics file, MOBILE_REGRESSION_REPORT.md

---

## CANONICAL SOURCES

| Resource | Location |
|---|---|
| App root | `/home/lucaspc3/Desktop/Project Organizer/Ledgerman/ledgerman/app/` |
| Backend | `/home/lucaspc3/Desktop/Project Organizer/Ledgerman/ledgerman-backend/` |
| Browser tests | `/home/lucaspc3/Desktop/Project Organizer/Ledgerman/browser-tests/` |
| @playwright/test | `browser-tests/node_modules/@playwright/test` (v1.59.1) |
| Existing spec | `browser-tests/password-flow.spec.js` |
| Playwright config | `browser-tests/playwright.config.js` |
| Production URL | `https://app.ledgerman.org` |
| Admin portal URL | `https://app.ledgerman.org/` (serves index.html) |
| Worker portal URL | `https://app.ledgerman.org/daily-report.html` |

---

## CONFIRMED FACTS (evidence-based)

1. **Playwright IS installed** — `@playwright/test` 1.59.1 at `browser-tests/node_modules/@playwright/test`
2. **`npx playwright test` works** from `browser-tests/` dir (confirmed by listing test output)
3. **Existing test strategy** — `page.route()` for API mocking + `page.evaluate()` for direct JS injection; no real credentials needed
4. **Admin portal is a fully vanilla SPA** loaded from `index.html`; all admin + worker modules in one bundle
5. **Auth state** — stored in `sessionStorage` (JWT + companyId) during session; `localStorage` for persistent login
6. **Auth bypass path** — after page load, set `App.currentUser` + pre-populate localStorage with empty cache + call `App.startAdminPanel()`. Works because:
   - `navigate()` authwall checks `this.currentUser`
   - `AdminDashboard.render()` reads from `_cache` or falls back to localStorage (both can be empty without crash)
   - `fetchModules()` and `getLogo()` both have `.catch(() => {})` guards
7. **Worker portal** (`daily-report.html`) is a separate self-contained SPA; tested independently at its own URL
8. **API calls during test** — all routed via `page.route('**/api/**', ...)` to mock responses
9. **No `package.json`** in `browser-tests/` — only `package-lock.json` and `node_modules/`
10. **TEST_BASE_URL env var** — tests use `process.env.TEST_BASE_URL || 'https://app.ledgerman.org'`
11. **`playwright.config.js`** uses `testDir: '.'` — any `.spec.js` in the dir is auto-discovered
12. **`_redirects`** — `ledgerman.org` → `app.ledgerman.org` (301); tests should target `app.ledgerman.org` directly to avoid redirect complications
13. **Screenshots dir** — Playwright's `test-results/` already exists in `browser-tests/`
14. **Google Fonts CDN** — loaded in `index.html`; in tests we can bypass with `page.route()` or allow it (non-critical)

---

## UNVERIFIED CLAIMS

- UNVERIFIED: Whether the production Chromium browsers are installed for Playwright (tested `npx playwright --version` but not `playwright install chromium`). If Chromium is not installed, tests will fail with "browser not found". Mitigation: test script will print clear error message; install with `npx playwright install chromium`.
- UNVERIFIED: Whether `https://app.ledgerman.org` is accessible from this machine during test execution (could be behind auth, network restrictions). Tests can run against localhost if needed.
- UNVERIFIED: Whether `AdminInvoices.renderCreate()` or `AdminInvoices.renderDetail()` can be triggered to open an invoice modal with empty data. Need to test at runtime.

---

## RISK ASSESSMENT: LOW

| Risk | Level | Mitigation |
|---|---|---|
| Playwright Chromium not installed | LOW | `npx playwright install chromium` |
| Test flakiness on production URL (network) | LOW | `TEST_BASE_URL` can be overridden to localhost |
| Breaking existing password-flow.spec.js | NONE | We're not modifying that file or the config structure |
| App code modification | NONE | Tests inject state only; no app files modified |
| Production data exposure | NONE | Tests use mocked API responses only |
| Secrets in test output | NONE | No real credentials used |

---

## FILES TO CREATE (3 new files)

### 1. `browser-tests/mobile-regression.spec.js`
The main test spec. Contains:
- `VIEWPORTS` constant: `[375, 390, 414]`
- `setupAdminPage(page)` helper — mocks APIs, injects auth, starts admin panel
- `checkOverflow(page, label)` helper — checks scrollWidth, scans elements for overflow, checks overflow:hidden on root
- `checkTouchTargets(page, label)` helper — finds interactive elements < 44px, returns warnings
- `captureScreenshot(page, name)` helper — saves to `browser-tests/mobile-screenshots/`
- Tests:
  - `admin-dashboard` — navigate to dashboard, check overflow
  - `admin-invoices` — navigate to invoices, attempt to open create modal, check modal overflow
  - `admin-contracts` — navigate to contracts, check overflow
  - `admin-budget-tracking` — navigate to budget-tracking, check overflow
  - `admin-resource-groups` — navigate to resource-groups, check overflow
  - `worker-portal` — load daily-report.html, check overflow on login screen
  - `ai-assistant` — open AI FAB panel, check overflow

### 2. `browser-tests/package.json`
Adds `npm run test:mobile` and `npm run test:all` scripts.

### 3. `browser-tests/playwright.config.js` (UPDATE, not replace)
Add mobile viewport projects to the existing config.

---

## IMPLEMENTATION SEQUENCE (after approval)

1. Create `mobile-regression.spec.js`
2. Create `package.json`
3. Update `playwright.config.js` to add mobile projects
4. Run `npx playwright install chromium` if Chromium not present
5. Execute `npm run test:mobile` (or `npx playwright test mobile-regression.spec.js`)
6. Capture output and create `MOBILE_REGRESSION_REPORT.md`

---

## ROLLBACK PLAN
Delete the 3 created/modified files:
```bash
rm browser-tests/mobile-regression.spec.js
rm browser-tests/package.json
# restore original playwright.config.js from git
git checkout browser-tests/playwright.config.js
```

---

## LAST VERIFIED STATE
Discovery complete. No files modified. Playwright confirmed working.

---

## STOP CONDITIONS ENCOUNTERED
None.
