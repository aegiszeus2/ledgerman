# QA Test Execution Matrix — Ledgerman
**Date:** 2026-03-22 | **Tester:** Automated + Manual | **Status:** BASELINE MAPPING

---

## EXECUTIVE SUMMARY

- **Total Test Cases:** 150+
- **Automated Tests (Playwright):** 45
- **Manual Tests:** 105+
- **Known Bugs Identified:** 14
- **Critical Blockers:** 3
- **High Priority Issues:** 5

**RECOMMENDATION:** Do not launch until critical blockers resolved.

---

## TEST MATRIX — CORE FEATURES

### AUTHENTICATION (35 Tests)

#### Worker Login (8 Tests)
| Test Case | Steps | Expected Result | Status | Bug | Notes |
|-----------|-------|-----------------|--------|-----|-------|
| Valid PIN login | Enter valid PIN (1234) → Submit | Dashboard loads | **PENDING** | — | Requires test PIN seeded |
| Invalid PIN | Enter wrong PIN → Submit | "Invalid PIN" error | **PENDING** | — | Clear form, focus input |
| Short PIN (< 4 digits) | Enter 123 → Submit | Error or validation block | **PENDING** | — | HTML5 validation |
| Numeric-only PIN | Enter "abcd" → Submit | Error | **PENDING** | — | inputmode="numeric" enforced |
| Pin with spaces | Enter "12 34" → Submit | Should trim or error | **PENDING** | #3 | Mobile keyboard spaces |
| Rapid attempts (5+) | Fail 5 times, 6th attempt | 60-second lockout | **PENDING** | — | Lockout check working |
| Lockout message | During lockout, see countdown | "Try again in 45 seconds" | **PENDING** | #7 | Countdown should update |
| 2FA required | Worker with TOTP enabled | Redirect to TOTP entry | **PENDING** | — | Server-side config |

#### Admin Login (9 Tests)
| Test Case | Steps | Expected Result | Status | Bug | Notes |
|-----------|-------|-----------------|--------|-----|-------|
| Valid password | Enter "TestAdmin123!" → Submit | Dashboard loads | **PENDING** | — | Assumes password set |
| Invalid password | Enter wrong password → Submit | "Invalid password" error | **PENDING** | — | Clear form |
| Empty password | Submit blank → Submit | Error | **PENDING** | — | HTML5 validation |
| Password with spaces | Enter "TestAdmin123! " (trailing) | Should trim or match | **FAIL** | #3 (FIXED) | Fixed in commit 3004816 |
| Special characters | Password "P@ss!123#" → Submit | Accepted | **PENDING** | — | Special chars supported |
| Rapid attempts (5+) | Fail 5 times, 6th attempt | 60-second lockout | **PENDING** | — | Same as worker |
| Case sensitivity | Enter "testadmin123!" (lowercase) | Error | **PENDING** | — | Passwords case-sensitive |
| Copy/paste password | Paste from email with spaces | Should work (trim) | **FAIL** | #3 (FIXED) | Mobile users copy/paste |
| Browser autocomplete | Browser fills password | Works correctly | **PENDING** | — | Don't clear on focus |

#### Company Signup (8 Tests)
| Test Case | Steps | Expected Result | Status | Bug | Notes |
|-----------|-------|-----------------|--------|-----|-------|
| Valid signup | Enter name + password → Submit | Company created, JWT stored | **PENDING** | — | Unique name required |
| Duplicate name | Register same company twice | "Already exists" error | **PENDING** | — | Check uniqueness |
| Short name (< 3 chars) | Enter "AB" → Submit | "Minimum 3 chars" | **PENDING** | — | Validation |
| Long name (> 100 chars) | 200-char name → Submit | Truncated or error | **PENDING** | — | UI/UX decision |
| Unicode name | "Café Constructión" → Submit | Accepted | **PENDING** | — | UTF-8 support |
| Emoji in name | "🏗️ Construction Co" → Submit | Accepted or error | **PENDING** | — | Browser-dependent |
| SQL injection attempt | `"'; DROP TABLE;--"` → Submit | Sanitized, stored as literal | **FAIL** | #8 | Backend validation needed |
| XSS attempt | `<script>alert('xss')</script>` → Submit | Escaped, displayed as text | **FAIL** | #9 | Frontend + backend |

#### 2FA TOTP (6 Tests)
| Test Case | Steps | Expected Result | Status | Bug | Notes |
|-----------|-------|-----------------|--------|-----|-------|
| Valid code | Enter 6-digit TOTP code → Submit | Worker logged in | **PENDING** | — | Time-synced |
| Invalid code | Enter "000000" (wrong) → Submit | "Invalid code" error | **PENDING** | — | No retry limit visible |
| Expired code (>60s) | Wait >60s, enter old code → Submit | "Code expired" error | **PENDING** | — | 30-60s window |
| Code with spaces | Enter "123 456" → Submit | Spaces stripped | **PENDING** | — | UX improvement |
| Rapid attempts | Try wrong code 5+ times | Locked out? | **PENDING** | — | No visible rate limit |
| Backup codes | User hasn't generated backups | Test expected behavior | **PENDING** | — | Not yet implemented |

#### 2FA Email (4 Tests)
| Test Case | Steps | Expected Result | Status | Bug | Notes |
|-----------|-------|-----------------|--------|-----|-------|
| Valid code | Email arrives, enter code → Submit | Worker logged in | **PENDING** | — | 15-minute window |
| Code reused | Enter same code twice | "Already used" error | **PENDING** | — | One-time use |
| Resend code | Click "Resend Code" 3x | Works each time | **PENDING** | — | Rate limit? |
| Expired code | Wait >15 min, enter code → Submit | "Code expired" error | **PENDING** | — | 15-minute TTL |

#### Password Reset (4 Tests)
| Test Case | Steps | Expected Result | Status | Bug | Notes |
|-----------|-------|-----------------|--------|-----|-------|
| Valid reset | Forgot password → Email → Code → New password → Login | Success | **PENDING** | — | End-to-end flow |
| Expired code | Request reset, wait 24h, use code | "Code expired" error | **PENDING** | — | Time-based |
| Code tampering | Modify code to "000000" → Submit | Error | **PENDING** | — | Validate code format |
| Password mismatch | New: "Pass123!", Confirm: "Pass124!" | "Passwords don't match" error | **PENDING** | — | Client-side validation |

---

### FORMS & DATA (40 Tests)

#### Company Management (10 Tests)
| Test Case | Steps | Expected Result | Status | Bug | Notes |
|-----------|-------|-----------------|--------|-----|-------|
| Create company (signup) | Name, password → Submit | Company created | **PENDING** | — | Unique name check |
| Edit company name | Current: "Belfort Con" → "Belfort Construction" | Saved | **FAIL** | #4 | User reported change didn't save |
| Edit company email | New email: "info@new.com" → Confirm 2x | Saved | **FAIL** | #4 | Same issue as above |
| Edit company password | New admin password → Confirm | Updated | **PENDING** | #4 | Part of same bug |
| Delete company | Confirm delete → Verify not in list | Deleted, workers logged out | **PENDING** | — | Cascade delete |
| Cannot delete self | Super admin tries to delete own company | Error "Cannot delete" | **PENDING** | — | Permission check |
| Edit form double-confirm | Click confirm, then cancel, retry | Works | **PENDING** | — | State management |
| Very long email (255 chars) | Email at max length → Save | Accepted | **PENDING** | — | DB field size |
| Email with + addressing | "user+tag@domain.com" → Save | Accepted | **PENDING** | — | RFC compliance |
| Concurrent edits | Edit company A from 2 browser tabs | Last write wins? | **PENDING** | — | Race condition |

#### Workers (8 Tests)
| Test Case | Steps | Expected Result | Status | Bug | Notes |
|-----------|-------|-----------------|--------|-----|-------|
| Create worker | Name, PIN, role → Submit | Worker created | **PENDING** | — | Can login with PIN |
| Duplicate PIN | Create worker with PIN 1234, then another with 1234 | Error "PIN in use" | **PENDING** | — | Uniqueness per company |
| PIN "0000" | Create worker with PIN 0000 → Try login | Accepted (edge case) | **PENDING** | — | All zeros valid? |
| Worker name with accents | "José García" → Create | Accepted | **PENDING** | — | UTF-8 storage |
| Delete worker | Delete worker, verify not in list | Removed, can't login | **PENDING** | — | Permissions revoked |
| Mark inactive | Change worker status to Inactive | Can't login | **PENDING** | — | Status check at auth |
| Worker with 2FA | Set worker 2FA enabled → Login | TOTP required | **PENDING** | — | 2FA flow |
| Bulk create (1000 workers) | Create 1000+ workers | Performance acceptable | **PENDING** | — | Scalability test |

#### Projects (6 Tests)
| Test Case | Steps | Expected Result | Status | Bug | Notes |
|-----------|-------|-----------------|--------|-----|-------|
| Create project | Name, description, client, dates → Submit | Project created | **PENDING** | — | Date validation |
| Invalid date range | End date < Start date → Submit | Error | **PENDING** | — | Validation |
| Project without description | Leave blank → Submit | Accepted | **PENDING** | — | Optional field |
| Client selection required | No client selected → Submit | Error | **PENDING** | — | Foreign key |
| Duplicate project name | Same name allowed? | Should allow | **PENDING** | — | Uniqueness per company |
| Edit project dates | Change start/end → Save | Saved | **PENDING** | — | Date picker UX |

#### Time Entries (8 Tests)
| Test Case | Steps | Expected Result | Status | Bug | Notes |
|-----------|-------|-----------------|--------|-----|-------|
| Submit valid entry | Date, hours (8), project → Submit | Entry created, status "Pending" | **PENDING** | — | API submission |
| Hours = 0 | Enter 0 → Submit | Accepted (edge case) | **PENDING** | — | Valid? |
| Hours = 24 | Enter 24 → Submit | Accepted (full day) | **PENDING** | — | Boundary |
| Hours > 24 | Enter 25 → Submit | Error "Maximum 24" | **PENDING** | — | Validation |
| Decimal hours | Enter 7.5 → Submit | Accepted | **PENDING** | — | Time precision |
| Future date | Tomorrow's date → Submit | Error "Can't submit future" | **PENDING** | — | Validation |
| Past date (1 year ago) | 2025-03-22 → Submit | Accepted (old entry) | **PENDING** | — | Historical entries |
| No project selected | Submit without project → Submit | Error "Project required" | **PENDING** | — | Validation |

#### Photo Upload (8 Tests)
| Test Case | Steps | Expected Result | Status | Bug | Notes |
|-----------|-------|-----------------|--------|-----|-------|
| Valid JPG upload | Select JPG file → Upload | Stored in IndexedDB | **PENDING** | — | Preview shown |
| Valid PNG upload | Select PNG file → Upload | Stored | **PENDING** | — | Transparent PNG OK? |
| WEBP format | Select WEBP → Upload | Accepted (if supported) | **PENDING** | — | Modern format |
| > 10MB file | Select 50MB file → Upload | Error "File too large" | **PENDING** | — | Size validation |
| Corrupted file | Fake JPG (text file) → Upload | Error "Invalid image" | **PENDING** | — | Magic number check |
| 1x1 pixel image | Tiny image → Upload | Error "Too small" or accepted | **PENDING** | — | Min dimension |
| Rapid uploads | Click multiple times quickly | Handled gracefully | **PENDING** | — | No duplicate submissions |
| Storage full (IndexedDB quota) | Fill DB, try upload | Error "Storage full" | **PENDING** | — | Edge case |

---

### ERROR HANDLING (15 Tests)

#### API Errors (8 Tests)
| Test Case | Steps | Expected Result | Status | Bug | Notes |
|-----------|-------|-----------------|--------|-----|-------|
| 403 Forbidden | Call API without permission | "Permission denied" (not "Connection failed") | **FAIL** | #5 | Error mapping bug |
| 404 Not Found | Call non-existent endpoint | "Not found" or graceful error | **PENDING** | #5 | Same issue |
| 500 Server Error | Backend crashes → Try action | "Server error, try again" | **PENDING** | — | Retry available? |
| 401 Unauthorized | Expired JWT → Call API | Redirect to login | **FAIL** | #10 | Token not validated |
| Network timeout | API doesn't respond (>10s) | "Connection timeout" error | **PENDING** | — | Timeout handling |
| Network disconnect | Internet drops mid-request | Graceful error, queue action | **PENDING** | #13 | Offline handling |
| Rate limit (429) | Exceed rate limit → Call API | "Too many requests" message | **PENDING** | #12 | Rate limiting not visible |
| Invalid JSON response | Backend returns malformed JSON | Error, not crash | **PENDING** | — | Error handling |

#### Mobile-Specific (7 Tests)
| Test Case | Steps | Expected Result | Status | Bug | Notes |
|-----------|-------|-----------------|--------|-----|-------|
| Cache not invalidated | Deploy fix, reload on mobile | See new UI (not cached) | **FAIL** | #6 | User sees old version |
| URL autocorrect | Type "admin.ledgerman.org" in iPhone | Autocorrect doesn't break URL | **FAIL** | — | Safari history corruption |
| Keyboard appearance | Password field → Tap | Mobile keyboard appears | **PENDING** | — | inputmode="password" |
| Long input with spaces | Enter password with trailing space | Stripped or handled | **FAIL** | #3 (FIXED) | Mobile keyboards add spaces |
| Rotate device | Portrait → Landscape while in form | Form remains usable | **PENDING** | — | Responsive design |
| Touch targets | Button size, clickable area | ≥ 44x44 pixels | **PENDING** | — | A11y standard |
| Slow network (3G) | Simulate slow network, load page | Acceptable performance | **PENDING** | — | Performance |

---

### SECURITY (12 Tests)

#### Password Storage & Handling (4 Tests)
| Test Case | Steps | Expected Result | Status | Bug | Notes |
|-----------|-------|-----------------|--------|-----|-------|
| Password hashing | Register → Check DB | Password is bcrypt hash, not plain text | **FAIL** | #1 | Critical vulnerability |
| Bcrypt verification | Login with correct password | Works | **FAIL** | #1 | Requires bcrypt fix |
| Login attempt throttling | 5 wrong attempts | Locked for 60s | **PENDING** | — | Defense against brute force |
| Password in localStorage? | Check browser storage | JWT token stored, not password | **PENDING** | — | Never store password |

#### CSRF Protection (1 Test)
| Test Case | Steps | Expected Result | Status | Bug | Notes |
|-----------|-------|-----------------|--------|-----|-------|
| CSRF token validation | POST without CSRF token | Request blocked | **FAIL** | #11 | Not implemented |

#### XSS Prevention (3 Tests)
| Test Case | Steps | Expected Result | Status | Bug | Notes |
|-----------|-------|-----------------|--------|-----|-------|
| Script injection in name | Company name: `<script>alert('xss')</script>` | Escaped/sanitized, displayed as text | **FAIL** | #9 | innerHTML danger |
| Image onerror injection | Company name: `<img src=x onerror="alert('xss')">` | Escaped, not executed | **FAIL** | #9 | innerHTML danger |
| DOM-based XSS | Manipulate URL fragment → Injected into page | Input validated/escaped | **PENDING** | — | Dynamic content check |

#### SQL Injection (2 Tests)
| Test Case | Steps | Expected Result | Status | Bug | Notes |
|-----------|-------|-----------------|--------|-----|-------|
| SQL injection in company name | `"'; DROP TABLE companies; --"` | Sanitized/parameterized | **FAIL** | #8 | Backend validation |
| Blind SQL injection | Timing-based attack → Measure response time | Request blocked or parameterized | **FAIL** | #8 | Backend issue |

#### JWT Handling (2 Tests)
| Test Case | Steps | Expected Result | Status | Bug | Notes |
|-----------|-------|-----------------|--------|-----|-------|
| Expired JWT | Token exp claim past → Call API | Redirect to login | **FAIL** | #10 | Token not validated |
| JWT tampering | Modify JWT in localStorage → Call API | Request rejected | **PENDING** | — | Signature verification |

---

## BUG TRACKING

### Critical Blockers

**Bug #1: Plain-Text Password Storage**
- **Status:** ⚠️ UNFIXED
- **Impact:** All passwords exposed if DB breached
- **Estimated Fix:** 2-4 hours
- **Tests Affected:** All password-based tests
- **Fix Required:** Implement bcrypt on registration and login verification

**Bug #2: Admin Console Login Broken**
- **Status:** ⚠️ PARTIALLY FIXED (JS error fixed, auth still failing)
- **Impact:** Super admin cannot onboard customers
- **Estimated Fix:** 1-2 hours
- **Tests Affected:** All super admin tests
- **Fix Required:** Debug authentication handler, verify API endpoint

**Bug #3: Whitespace Not Trimmed**
- **Status:** ✅ FIXED (commit 3004816)
- **Impact:** Valid passwords fail on mobile
- **Fix Applied:** `.trim()` on password and company name fields
- **Tests Affected:** Mobile login tests
- **Verification Required:** Test on iPhone with trailing spaces

**Bug #4: Form Saves Don't Persist**
- **Status:** ⚠️ UNFIXED
- **Impact:** Admin changes appear to save but don't
- **Estimated Fix:** 1-2 hours
- **Tests Affected:** Company edit, worker edit, project edit
- **Fix Required:** Debug form submission handler, verify API response handling

**Bug #5: Error Messages Misleading**
- **Status:** ⚠️ UNFIXED
- **Impact:** 403 errors shown as "Connection failed"
- **Estimated Fix:** 1 hour
- **Tests Affected:** Error handling tests
- **Fix Required:** Parse HTTP status, return specific error message

**Bug #6: Mobile Cache Not Invalidating**
- **Status:** ⚠️ UNFIXED
- **Impact:** Users see cached old UI after deployment
- **Estimated Fix:** 1 hour
- **Tests Affected:** Mobile cache test
- **Fix Required:** Add max-age=0, versioned query params, cache-busting headers

**Bug #7: Login Lockout No Countdown**
- **Status:** ⚠️ UNFIXED
- **Impact:** User sees "60 seconds" once, no update
- **Estimated Fix:** 1 hour
- **Tests Affected:** Lockout UX test
- **Fix Required:** Update countdown timer every second

**Bug #8: SQL Injection Not Prevented**
- **Status:** ⚠️ UNFIXED (backend)
- **Impact:** Potential database compromise
- **Estimated Fix:** 2 hours
- **Tests Affected:** SQL injection tests
- **Fix Required:** Use parameterized queries, whitelist validation

**Bug #9: XSS Not Prevented**
- **Status:** ⚠️ UNFIXED
- **Impact:** Stored XSS vulnerability
- **Estimated Fix:** 1-2 hours
- **Tests Affected:** XSS tests
- **Fix Required:** Use textContent, sanitize user input, CSP headers

**Bug #10: JWT Token Not Validated**
- **Status:** ⚠️ UNFIXED
- **Impact:** Expired tokens continue to be used
- **Estimated Fix:** 1 hour
- **Tests Affected:** JWT expiration test
- **Fix Required:** Decode JWT, check exp claim, redirect if expired

**Bug #11: No CSRF Protection**
- **Status:** ⚠️ UNFIXED (backend)
- **Impact:** Cross-site request forgery possible
- **Estimated Fix:** 1-2 hours
- **Tests Affected:** CSRF test
- **Fix Required:** Add CSRF token to all forms, validate on POST

**Bug #12: No Rate Limiting**
- **Status:** ⚠️ UNFIXED (backend)
- **Impact:** Brute force attacks possible
- **Estimated Fix:** 1 hour
- **Tests Affected:** Rate limit test
- **Fix Required:** Implement rate limiting (10 req/min per IP)

**Bug #13: Offline Sync Not Tested**
- **Status:** ⚠️ UNTESTED
- **Impact:** Data loss or corruption on offline submission
- **Estimated Fix:** 2-3 hours (test + fix)
- **Tests Affected:** Offline sync test
- **Fix Required:** Test offline → online sync, handle conflicts

**Bug #14: No Data Validation on IndexedDB Writes**
- **Status:** ⚠️ UNTESTED
- **Impact:** Corrupted data could crash app
- **Estimated Fix:** 1 hour
- **Tests Affected:** Data integrity test
- **Fix Required:** Validate schema before writes

---

## TEST EXECUTION COMMANDS

### Run All Tests
```bash
npx playwright test e2e-tests-comprehensive.spec.js
```

### Run Specific Suite
```bash
npx playwright test e2e-tests-comprehensive.spec.js -g "Worker Login"
```

### Run with Headed Browser (Visual Debugging)
```bash
npx playwright test e2e-tests-comprehensive.spec.js --headed
```

### Run on Mobile Only
```bash
npx playwright test e2e-tests-comprehensive.spec.js -g "Mobile"
```

### Generate HTML Report
```bash
npx playwright test && npx playwright show-report
```

---

## REGRESSION CHECKLIST (Post-Fix)

After applying any fix, execute this checklist:

- [ ] Worker login (valid PIN, invalid PIN, lockout)
- [ ] Admin login (valid password, invalid password, lockout)
- [ ] Company signup (new company, duplicate name)
- [ ] Company edit (name, email, verify persisted)
- [ ] Worker management (create, delete, status change)
- [ ] Forms (time entry, photo upload, valid/invalid)
- [ ] Password reset (valid flow, expired code)
- [ ] 2FA TOTP (valid code, invalid code)
- [ ] 2FA Email (valid code, reused code)
- [ ] Error handling (403, 500, timeout)
- [ ] Mobile tests (layout, cache, input)
- [ ] Security tests (XSS, SQL injection, password storage)
- [ ] No console errors on load
- [ ] Performance acceptable (< 3s page load)
- [ ] Offline mode still works (if applicable)

---

## LAUNCH READINESS CHECKLIST

Do NOT launch until ALL are complete:

- [ ] **Bug #1:** Plain-text passwords fixed (bcrypt)
- [ ] **Bug #2:** Admin console login working
- [ ] **Bug #3:** Whitespace trimming verified on mobile
- [ ] **Bug #4:** Form persistence verified
- [ ] **Bug #5:** Error messages specific and helpful
- [ ] **Bug #8:** SQL injection prevention (parameterized queries)
- [ ] **Bug #9:** XSS prevention (sanitization + CSP)
- [ ] **Bug #11:** CSRF protection enabled
- [ ] All critical security tests passing
- [ ] Regression tests 100% passing
- [ ] Performance acceptable (< 3s, < 5s on 3G)
- [ ] Mobile tests passing (iPhone, Android)
- [ ] Super admin console fully functional
- [ ] Documentation updated

---

**Next Steps:**
1. Run baseline test suite (`npx playwright test`)
2. Document actual test results (not pending)
3. Prioritize bug fixes (Critical → High → Medium)
4. Re-run regression suite after each fix
5. Get sign-off before launch

