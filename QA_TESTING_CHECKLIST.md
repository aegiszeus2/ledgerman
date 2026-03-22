# LEDGERMAN — QA TESTING CHECKLIST

**Purpose:** Every feature upgrade must be tested with this regime before deployment.  
**Responsibility:** LittleShield (automated) + Lucas (manual verification)  
**Update Frequency:** After every commit to main

---

## PRE-DEPLOYMENT CHECKLIST (AUTOMATED)

### Code Quality
- [ ] No console.error() without handling
- [ ] No commented-out code
- [ ] No `var` declarations (use `const`/`let`)
- [ ] All API calls use try/catch or .catch()
- [ ] No hardcoded URLs (use config.js)
- [ ] No console.log() left in production code

### Security
- [ ] No plain-text password comparisons (use bcrypt)
- [ ] No direct SQL concatenation (use parameterized queries)
- [ ] No eval() or innerHTML with user input
- [ ] CORS headers correct (no wildcard origin)
- [ ] Rate limiting active (flask_limiter)
- [ ] Audit logging implemented for sensitive actions

### API Contract
- [ ] All endpoints return JSON (Content-Type: application/json)
- [ ] Error responses have `error` field + HTTP status code
- [ ] Success responses have `200` or `201` status
- [ ] All required fields documented in code comments
- [ ] Request/response examples in CONTEXT.md

### Database
- [ ] Schema migrations tested
- [ ] Backup created before deploy
- [ ] No N+1 query problems
- [ ] Indexes on frequently-queried columns

### Frontend
- [ ] No horizontal scroll on 375px viewport
- [ ] Touch targets ≥44px
- [ ] Form inputs ≥16px (mobile) to avoid auto-zoom
- [ ] Loading spinners on slow operations (>1s)
- [ ] Error messages user-friendly (not stack traces)
- [ ] Cache-Control headers set correctly

---

## MANUAL TESTING CHECKLIST (LUCAS)

### Happy Path (Works Correctly)

**Authentication Flow**
```
[ ] Admin login: company + password → dashboard
[ ] Worker login: company + PIN → time entry screen
[ ] 2FA optional: if enabled, code required
[ ] Logout: JWT cleared, redirect to login
[ ] Session persists: refresh → still logged in
[ ] URL auto-fill: ?company=X&password=Y → auto-submit
```

**Dashboard (Admin)**
```
[ ] Load time <2s
[ ] Worker list shows all active workers
[ ] Clock in/out buttons visible and clickable
[ ] Real-time updates (change in worker app → dashboard updates <5s)
[ ] Date selector works (view past dates)
[ ] Overtime alerts display
```

**Time Entry (Worker)**
```
[ ] Clock in: timestamp recorded
[ ] Clock out: duration calculated
[ ] 15-min rounding applied
[ ] History shows all entries
[ ] Can edit past entries (time only, not duration)
```

**Forms (All CRUD)**
```
[ ] Create: form loads, all fields visible, submit works
[ ] Read: data displays correctly
[ ] Edit: changes save, reflected immediately
[ ] Delete: confirm dialog, no undo possible
[ ] Validation: missing required fields → error before submit
```

**Mobile Specific**
```
[ ] No horizontal scroll
[ ] Buttons full-width and tappable
[ ] Keyboard doesn't cover input fields
[ ] Touch gestures work (no double-tap zoom)
[ ] Landscape orientation supported (if relevant)
```

---

## FAILURE CASE TESTING (Edge Cases)

### Authentication
```
[ ] Wrong password: error message, login blocked
[ ] Company not found: error message
[ ] Empty fields: form blocked, no submit
[ ] Whitespace in password: " Admin123456! " works
[ ] Case sensitivity: "BELFORT con" vs "Belfort Con"
[ ] Special characters: passwords with !@#$ work
```

### Form Validation
```
[ ] Required fields empty: error before submit
[ ] Invalid email: rejected
[ ] Negative amounts: rejected (where applicable)
[ ] Dates in future: rejected (where applicable)
[ ] SQL injection ("' OR '1'='1"): safely rejected
[ ] XSS ("<script>alert('xss')</script>"): escaped, not executed
[ ] Very long strings (>1000 chars): handled gracefully
```

### API/Network
```
[ ] Slow network (3G): spinners appear, timeout graceful
[ ] Offline: appropriate error message
[ ] Server error (500): clear message, no stack trace
[ ] Unauthorized (401): redirect to login
[ ] Forbidden (403): error message (not generic "failed to load")
[ ] Rate limit (429): explain why and when retry available
```

### Data Integrity
```
[ ] Concurrent edits: last one wins (or conflict message)
[ ] Delete entity: confirm dialog, no undo
[ ] Create with duplicate name: allowed or error clearly shown
[ ] Large datasets: pagination works, no slowdown
[ ] Sorting/filtering: correct results, no data loss
```

---

## REGRESSION TESTING (Before & After)

### After Every Fix
Test these critical paths to ensure nothing broke:

1. **Login Path** (most critical)
   ```
   [ ] Admin login: company + password still works
   [ ] Worker login: company + PIN still works
   [ ] 2FA if enabled: code still required
   [ ] Logout: still clears JWT
   ```

2. **Core CRUD** (data integrity)
   ```
   [ ] Create entity: save works
   [ ] Edit entity: changes persist
   [ ] Delete entity: gone from list
   [ ] List view: shows correct count
   ```

3. **Time Tracking** (revenue critical)
   ```
   [ ] Clock in/out: times recorded correctly
   [ ] Rounding: 15-min rounding applied
   [ ] Reports: hours calculated correctly
   ```

4. **Performance** (mobile user experience)
   ```
   [ ] Page load: <3s on 4G
   [ ] Form submit: <1s response
   [ ] Navigation: smooth transitions
   ```

---

## SECURITY TESTING (Post-Deployment)

### After Every Authentication Change
```
[ ] Valid creds: login works
[ ] Invalid creds: rejected (no info leak)
[ ] SQLi attempt: safely rejected
[ ] XSS attempt: escaped, not executed
[ ] Rate limiting: 5 failed attempts → 429 response
[ ] CSRF: cross-origin POST rejected
[ ] JWT token: correctly validated, exp claim checked
[ ] Data isolation: Company A can't see Company B data
```

### After Every API Change
```
[ ] Authorization: endpoint checks role (admin/worker)
[ ] Audit log: action logged with user + timestamp
[ ] Error response: no sensitive data leaked
[ ] Status codes: correct HTTP codes (200/201/400/401/500)
```

---

## MOBILE-SPECIFIC TESTING (iOS & Android)

### Must Test On Actual Phone Before Deploy

**iOS (Safari)**
```
[ ] Orientations: portrait & landscape work
[ ] Long form: can scroll, no fields hidden
[ ] Input fields: ≥16px (auto-zoom disabled)
[ ] Buttons: full-width, tappable
[ ] Cache: clear history, reload → sees new code
[ ] iCloud Private Relay: disable if blocking requests
```

**Android (Chrome)**
```
[ ] Same as iOS
[ ] Back button: works correctly (or handled in app)
[ ] Vibration: haptic feedback on tap (if implemented)
```

**Critical:** Test cache behavior after deployment
```
[ ] Deploy new code to Render
[ ] On phone: don't clear cache yet
[ ] Reload page: should see NEW code within 5 minutes
  (If old code still showing: cache invalidation broken)
[ ] Clear browser cache: Settings → [browser] → Clear Data
[ ] Reload: should see new code immediately
```

---

## PERFORMANCE TESTING

### Before Production Deploy

**Desktop (Chrome DevTools)**
```
[ ] Lighthouse score: ≥80
[ ] Time to Interactive: <3s
[ ] Largest Contentful Paint: <2.5s
[ ] Cumulative Layout Shift: <0.1
```

**Mobile (Chrome DevTools - Throttle to 4G)**
```
[ ] Time to Interactive: <5s
[ ] Largest Contentful Paint: <4s
[ ] First Input Delay: <100ms
```

**API Response Times (curl)**
```
[ ] Auth endpoint: <200ms
[ ] Sync/data fetch: <500ms
[ ] Photo upload: <2s (depending on size)
```

---

## BROWSER COMPATIBILITY (Desktop)

Test on latest versions:
```
[ ] Chrome: latest
[ ] Firefox: latest
[ ] Safari: latest
[ ] Edge: latest
```

Test on older versions (if supporting):
```
[ ] Chrome 90+
[ ] Firefox 88+
[ ] Safari 14+
[ ] Edge 90+
```

---

## LAUNCH CHECKLIST (Before Laurence & Damiano)

**Frontend**
```
[ ] App loads without errors
[ ] All pages accessible
[ ] No console errors
[ ] Mobile responsive
[ ] Cache invalidation working
[ ] SSL certificate valid
```

**Backend**
```
[ ] API health check passes
[ ] Database responsive
[ ] Backups running (2AM cron)
[ ] Error logging working
[ ] Rate limiting active
```

**Security**
```
[ ] Passwords bcrypt hashed
[ ] Super admin key rotated
[ ] No test data in production
[ ] Audit logging active
[ ] CORS headers correct
```

**Documentation**
```
[ ] User guide updated
[ ] API docs current
[ ] Error codes documented
[ ] Known issues listed
[ ] Recovery procedures documented
```

**Monitoring**
```
[ ] Health endpoint monitored
[ ] Error alerts configured
[ ] Performance baseline established
[ ] Database size monitored
```

---

## TEST FAILURE TRIAGE

If a test fails:

1. **Reproduce the failure**
   - Run test 3 times (is it flaky?)
   - Try on different device/browser
   - Check server logs

2. **Diagnose the root cause**
   - API working? (curl test)
   - Code deployed? (git hash match)
   - Database intact? (can query?)
   - Network issue? (ping response time)

3. **Document the failure**
   ```
   [ ] Screenshot/video of failure
   [ ] Error message (full stack trace)
   [ ] Device/browser version
   [ ] Steps to reproduce
   [ ] Server logs (timestamps matching)
   ```

4. **Create bug report**
   ```
   Feature: [name]
   Test Case: [what failed]
   Expected: [what should happen]
   Actual: [what did happen]
   Steps: [how to reproduce]
   Severity: [Critical/High/Medium/Low]
   Status: [Investigating/Blocked/In Fix]
   ```

---

## SIGN-OFF PROCEDURE

After testing is complete:

1. **Fill this checklist completely**
2. **Sign off with date**
3. **Update QA_TEST_RESULTS.md with findings**
4. **Add entry to AUDIT.md**
5. **Deploy to production**

**Example Sign-Off:**
```
QA Engineer: LittleShield
Date: 2026-03-22
Status: READY FOR PRODUCTION
Blockers: None
Tests Passed: 42/42
Known Issues: CRI-001 (password hashing - noted for Phase 3)
Comments: Belfort ready for Laurence beta testing on desktop
```

---

## FUTURE IMPROVEMENTS TO QA REGIME

- [ ] Automated Playwright tests in CI/CD (run on every commit)
- [ ] Visual regression testing (Percy or similar)
- [ ] Performance budget monitoring
- [ ] Database query performance monitoring
- [ ] Synthetic monitoring (uptime + latency alerts)
- [ ] User session recording (for debugging)
- [ ] A/B testing infrastructure
- [ ] Mobile device lab (real iPhone/Android for testing)

