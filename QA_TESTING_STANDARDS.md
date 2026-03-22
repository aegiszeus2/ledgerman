# QA Testing Standards — Ledgerman
**Effective:** 2026-03-22 | **Version:** 1.0 | **Status:** ACTIVE TESTING PROTOCOL

This document defines the quality assurance (QA) standards that must be applied to ALL feature development, bug fixes, and deployments. Every change goes through this regime before reaching production.

---

## MANDATE

**Every feature, every fix, every deployment must pass this testing protocol.**

This is not optional. It is not negotiable. Every line of code that ships must be verified by:
1. Automated tests (Playwright)
2. Manual smoke tests (QA checklist)
3. Regression tests (no breaking changes)
4. Security review (XSS, injection, auth)
5. Performance validation (load time, network)

---

## TESTING PHASES

### Phase 1: Development (Before Commit)

**Developer Responsibility:**
- [ ] Code review (self + peer)
- [ ] Unit tests (if applicable)
- [ ] Manual testing of feature (happy path + 3 failure cases)
- [ ] No console errors
- [ ] No TypeErrors or undefined references

**Tests to Run:**
```bash
npm run lint          # Code quality
npm run test:unit    # Unit tests (if applicable)
npm run dev          # Start local server
# Manually test feature in browser
```

**Checklist:**
- Feature works as designed ✅
- Form validation working ✅
- Error messages are clear ✅
- Mobile viewport tested ✅
- No console errors ✅
- Network requests logged (DevTools Network tab) ✅

### Phase 2: Pull Request (Before Merge)

**PR Requirements:**
- [ ] Code review approved
- [ ] Automated tests passing
- [ ] Test coverage added (for new features)
- [ ] No merge conflicts
- [ ] Commit messages clear and meaningful

**Tests to Run:**
```bash
git checkout feature-branch
npm install
npm run test          # All tests
npm run test:e2e     # E2E tests if applicable
```

**Playwright E2E Tests:**
```bash
npx playwright test e2e-tests-comprehensive.spec.js -g "Feature Name"
```

### Phase 3: Staging/Preview Deploy

**Before Deploying to Production:**
- [ ] All tests passing on staging
- [ ] Smoke test checklist completed
- [ ] No breaking changes visible
- [ ] Performance acceptable
- [ ] Mobile tested on real device (if possible)

**Smoke Test Checklist (5-10 minutes):**
```
AUTHENTICATION:
[ ] Worker login with valid PIN
[ ] Admin login with valid password
[ ] 2FA flow (if enabled)
[ ] Password reset flow
[ ] Logout

FORMS:
[ ] Create/edit/delete operations
[ ] Form validation (required fields, formats)
[ ] File uploads (if applicable)
[ ] Error messages clear

DATA:
[ ] Data displays correctly
[ ] Sorting/filtering works
[ ] Numbers/dates formatted correctly
[ ] No missing information

MOBILE:
[ ] Layout responsive
[ ] Forms usable on 375px width
[ ] Buttons clickable (44x44px)
[ ] Images load

PERFORMANCE:
[ ] Page loads < 3 seconds
[ ] No slow network issues visible
[ ] No memory leaks (DevTools → Memory)
```

### Phase 4: Production Deploy

**Pre-Deployment:**
- [ ] Feature complete and reviewed
- [ ] All tests passing
- [ ] Staging verified by QA
- [ ] Rollback plan ready

**Post-Deployment (Verify in Production):**
- [ ] Feature accessible at production URL
- [ ] No console errors in production
- [ ] API endpoints responding (check Render logs)
- [ ] Database queries returning data
- [ ] Third-party integrations working (if any)

**Monitoring (First 24 Hours):**
```bash
# Check Render logs for errors
render logs ledgeman-backend --tail

# Check frontend errors
# Visit admin.ledgerman.org, check browser console (F12)

# Test critical flows
# 1. Admin login
# 2. Worker login
# 3. Data submission
# 4. Data display
```

---

## TEST SCENARIOS BY FEATURE TYPE

### 1. AUTHENTICATION FEATURES

**Required Tests:**
- ✅ Valid login (correct credentials)
- ✅ Invalid login (wrong credentials)
- ✅ Account lockout (5 failed attempts, 60-second timeout)
- ✅ Whitespace handling (trim inputs)
- ✅ Special characters in password
- ✅ 2FA flow (if enabled)
- ✅ Password reset (email code, new password)
- ✅ Session persistence (token storage, expiration)
- ✅ Logout clears session

**Security Tests:**
- ✅ No plain-text passwords stored
- ✅ Passwords hashed (bcrypt)
- ✅ JWT validated on every request
- ✅ Expired tokens redirect to login
- ✅ CSRF tokens on all forms
- ✅ No hardcoded credentials

**Edge Cases:**
- ✅ Very long password (512+ chars)
- ✅ Copy/paste password (with spaces)
- ✅ Password with all special characters
- ✅ Rapid-fire login attempts (button spam)
- ✅ Browser back button during login
- ✅ Concurrent login from 2 devices

### 2. FORM FEATURES

**Required Tests:**
- ✅ Happy path (valid inputs → saved)
- ✅ Missing required fields → error
- ✅ Invalid format → error message
- ✅ Form retained on validation error
- ✅ Submit button disabled during request
- ✅ Success message/redirect after save
- ✅ Edit existing record (loads data)
- ✅ Delete with confirmation
- ✅ Cancel returns to previous state

**Validation Tests:**
- ✅ Email format (valid emails only)
- ✅ Phone format (if applicable)
- ✅ Number range (min/max)
- ✅ Date format & range (end > start)
- ✅ File size (max 10MB)
- ✅ File type (JPG, PNG only)
- ✅ String length (min/max chars)
- ✅ Unique values (no duplicates)
- ✅ SQL injection prevention
- ✅ XSS prevention

**Error Handling:**
- ✅ Network timeout → "Connection timeout" message
- ✅ Server error (500) → "Server error, try again"
- ✅ Permission error (403) → "You don't have permission"
- ✅ Not found (404) → "Resource not found"
- ✅ Rate limit (429) → "Too many requests"
- ✅ Invalid JSON response → graceful error (don't crash)

**Edge Cases:**
- ✅ Copy/paste with extra whitespace
- ✅ Very long input (> 255 chars)
- ✅ Unicode characters (ñ, é, 中文)
- ✅ Emoji in text fields
- ✅ HTML/script tags in input
- ✅ Double-click submit (prevent duplicate)
- ✅ Submit after field loses focus (autofill)
- ✅ Rapid form switches (before save completes)

### 3. DATA DISPLAY FEATURES

**Required Tests:**
- ✅ Data loads correctly (no missing fields)
- ✅ Data formatted correctly (numbers, dates, currency)
- ✅ Sorting works (click column header)
- ✅ Filtering works (search, dropdowns)
- ✅ Pagination works (next/prev page)
- ✅ Large datasets performant (1000+ rows)
- ✅ Empty state handled (no records → message)
- ✅ Loading state visible (spinner during fetch)

**Edge Cases:**
- ✅ Very long text (doesn't overflow layout)
- ✅ Very large numbers (formatting)
- ✅ Null/empty values (displayed as "—" or "N/A")
- ✅ Special characters in data (not escaped as &lt;)
- ✅ Images with alt text
- ✅ Currency decimals (0.01 vs 1.00)
- ✅ Dates in different formats

### 4. FILE UPLOAD FEATURES

**Required Tests:**
- ✅ Valid file upload (JPG, PNG)
- ✅ File too large (>10MB) → error
- ✅ Wrong file type (PDF) → error
- ✅ Corrupted file (text with .jpg extension) → error
- ✅ Preview visible before upload
- ✅ Progress bar during upload
- ✅ Success message after upload
- ✅ File stored correctly (IndexedDB or server)

**Security Tests:**
- ✅ No arbitrary file execution
- ✅ File names sanitized (no special paths like ../../../)
- ✅ MIME type validated (magic number check, not just extension)
- ✅ File size limit enforced

**Edge Cases:**
- ✅ 1x1 pixel image (too small?)
- ✅ 10000x10000px image (very large)
- ✅ Animated GIF
- ✅ Transparent PNG
- ✅ Grayscale image
- ✅ Rotated image (EXIF metadata)
- ✅ Rapid multiple uploads
- ✅ Upload without page refresh (AJAX)

### 5. PERFORMANCE & MOBILE

**Performance:**
- ✅ Page load < 3 seconds
- ✅ Interactive < 5 seconds
- ✅ API response < 1 second (network latency acceptable)
- ✅ No memory leaks (check DevTools Memory tab)
- ✅ No rendering jank (DevTools Performance tab)

**Mobile (375px width, iPhone):**
- ✅ Layout responsive (no horizontal scroll)
- ✅ Touch targets ≥ 44x44 pixels
- ✅ Font readable (≥ 14px)
- ✅ Form inputs focused on tap (keyboard appears)
- ✅ Images scaled correctly
- ✅ Navigation usable on small screen

**Offline:**
- ✅ App works offline (reads from cache)
- ✅ Offline indicator visible
- ✅ Data syncs when reconnected
- ✅ No data loss on reconnect
- ✅ Offline edits don't conflict with server

### 6. SECURITY

**All Features Must Pass:**

**Authentication:**
- [ ] No plain-text passwords
- [ ] Passwords hashed (bcrypt)
- [ ] Session tokens validated
- [ ] Expired tokens → redirect to login
- [ ] No credentials in localStorage
- [ ] No credentials in URL

**Input Validation:**
- [ ] SQL injection prevented (parameterized queries)
- [ ] XSS prevented (escaped output, sanitized input)
- [ ] Path traversal prevented (no ../ in file paths)
- [ ] LDAP injection prevented (if LDAP used)

**Authorization:**
- [ ] Only admins can admin functions
- [ ] Only workers can view own data
- [ ] Super admin only accesses own companies
- [ ] No privilege escalation

**API Security:**
- [ ] HTTPS only (no HTTP)
- [ ] CSRF tokens on POST/PUT/DELETE
- [ ] Rate limiting (prevent brute force)
- [ ] Secrets not logged
- [ ] No sensitive data in error messages

---

## TEST EXECUTION CHECKLIST

### For Every New Feature

Before committing, check:

- [ ] Feature works as designed
- [ ] All required tests written
- [ ] Happy path passes
- [ ] Failure cases handled
- [ ] Edge cases tested
- [ ] Mobile tested
- [ ] Security reviewed
- [ ] No console errors
- [ ] Performance acceptable
- [ ] Error messages clear
- [ ] Code reviewed
- [ ] Commit message descriptive

### For Every Bug Fix

Before committing, check:

- [ ] Root cause identified and fixed
- [ ] Fix verified in development
- [ ] Regression tests pass
- [ ] Related features still work
- [ ] No new issues introduced
- [ ] Performance unchanged
- [ ] Security not compromised

### For Every Deployment

Before deploying, check:

- [ ] All tests passing
- [ ] Staging verified
- [ ] Rollback plan ready
- [ ] Monitoring configured
- [ ] Database migrations tested (if any)
- [ ] Third-party integrations verified

---

## BUG SEVERITY LEVELS

### CRITICAL (Fix Immediately)
- Security vulnerability (auth bypass, data exposure)
- Data loss or corruption
- App crash on load
- Cannot login (blocks all users)

**Fix Time:** Same day | **Testing:** Full regression suite

### HIGH (Fix Within 24 Hours)
- Form doesn't save
- Permissions not enforced
- Payment/billing broken
- Password stored in plain text

**Fix Time:** Next work day | **Testing:** Full regression suite

### MEDIUM (Fix Within 1 Week)
- Form validation incomplete
- Error message misleading
- Performance issue (5s+ page load)
- Mobile layout broken

**Fix Time:** 1 week | **Testing:** Focused regression suite

### LOW (Fix When Convenient)
- UI polish (spacing, colors)
- Non-essential feature gap
- Typos in messages
- Edge case handling

**Fix Time:** Sprint backlog | **Testing:** Manual smoke test

---

## TEST DATA MANAGEMENT

### Test Company Setup
```javascript
// Seed test data
const testCompany = {
  name: "Test Construction Inc",
  adminPassword: "TestAdmin123!",
};

// Create in development
// Do NOT use production data for testing
```

### Reset Test Data
```bash
# Clear IndexedDB
localStorage.clear();
localStorage.removeItem('ledgeman_jwt');
localStorage.removeItem('ledgeman_companyId');

# Restart app
// Refresh page
```

### Staging vs Production
- **Staging:** Full test data, multiple scenarios
- **Production:** Real customer data, minimal testing (smoke tests only)

---

## TOOLS & COMMANDS

### Running Tests

**All Tests:**
```bash
npx playwright test e2e-tests-comprehensive.spec.js
```

**Specific Suite:**
```bash
npx playwright test e2e-tests-comprehensive.spec.js -g "Worker Login"
```

**Headed (Visual):**
```bash
npx playwright test e2e-tests-comprehensive.spec.js --headed
```

**Specific Browser:**
```bash
npx playwright test e2e-tests-comprehensive.spec.js --project=chromium
npx playwright test e2e-tests-comprehensive.spec.js --project=webkit
```

**With Report:**
```bash
npx playwright test && npx playwright show-report
```

### Manual Testing

**Desktop:**
- Firefox (for development)
- Chrome (for comparison)

**Mobile:**
- iPhone Safari (critical)
- Chrome Mobile (comparison)

**Tools:**
- DevTools Network tab (API calls)
- DevTools Console (errors, warnings)
- DevTools Performance (load times)
- DevTools Memory (leaks)

---

## DOCUMENTING TEST RESULTS

### Test Failure Report

When a test fails, document:

```markdown
## Test Failure Report

**Date:** 2026-03-22
**Test:** Worker Login > Valid PIN
**Expected:** Dashboard loads
**Actual:** "Invalid PIN" error despite correct PIN
**Conditions:** Mobile Safari, iOS 18.1, cold load
**Steps to Reproduce:**
1. Go to ledgerman.org
2. Click Worker Login
3. Enter PIN "1234"
4. Click Login

**Root Cause:** (After investigation)
Trailing space from mobile keyboard not trimmed

**Fix Applied:** `.trim()` on PIN input
**Verified:** Yes, on mobile device
```

### Test Pass Documentation

For significant features, document the test path:

```markdown
## Test Pass: Company Edit

**Date:** 2026-03-22
**Feature:** Edit company name and email
**Environment:** Production (admin.ledgerman.org)
**Test Path:**
1. Login with super admin key ✅
2. Click company "Belfort Con" ✅
3. Change name to "Belfort Construction" ✅
4. Confirm changes (double-click) ✅
5. Verify in company list ✅
6. Reload page, verify persistence ✅

**Status:** PASS
**Notes:** Name persisted correctly after fix #4
```

---

## REGRESSION TEST SCHEDULE

### Before Every Deployment
- Critical path: Login, submit data, view data
- Smoke test checklist (10 minutes)

### Weekly
- Full automated test suite (30 minutes)
- Manual testing of recent changes

### Monthly
- Security review
- Performance profiling
- Mobile testing on real devices

---

## ESCALATION PATH

If a test fails:

1. **Identify:** Confirm the failure is reproducible
2. **Isolate:** Determine if it's code, config, or environment
3. **Report:** File bug with full details (steps, expected, actual)
4. **Prioritize:** Assign severity level
5. **Fix:** Developer fixes root cause
6. **Verify:** QA re-runs test, confirms fix
7. **Close:** Bug marked resolved, test pass documented

---

## COMMITMENT

This testing regime is **non-negotiable**. Every feature, every fix, every deploy must follow this protocol.

**Exceptions are not permitted.** If you believe a feature is "simple" and doesn't need testing, that's the MOST important time to test it — simple changes often have unexpected side effects.

**Quality is not a sprint. It's a discipline.**

---

**Last Updated:** 2026-03-22
**Next Review:** 2026-06-22 (quarterly)

