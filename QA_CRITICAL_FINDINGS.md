# QA AUDIT — CRITICAL FINDINGS & BUG REPORT

**Date:** 2026-03-22
**Scope:** Complete Ledgerman SaaS codebase (backend + contractor app + admin console)
**Status:** 14 Bugs Found | 4 Critical | 5 High | 5 Medium

---

## CRITICAL BUGS (Must Fix Before Launch)

### 🔴 BUG #1: Password Whitespace Mismatch Causes Login Failure
**Severity:** CRITICAL
**Component:** Admin Console (create company) + Contractor App (login)
**Root Cause:** Password NOT trimmed during company creation, but IS trimmed during login attempt.

**Evidence:**
- **Admin console submission (line 1171):** `const pwd = document.getElementById('createCompanyPassword').value;` ← NO `.trim()`
- **Backend storage (line 150):** `body['adminPassword']` stored WITHOUT trimming
- **Contractor app login (line 686):** `const pw = document.getElementById('adminPassword').value.trim();` ← HAS `.trim()`
- **Backend comparison (line 221):** `body['password'] == company['admin_password']` ← Direct string match, NO trimming

**Scenario:** If admin pastes password with trailing space, it's stored with the space. When user tries to login, frontend sends trimmed password, comparison fails with "Invalid password" error.

**Fix Required:**
1. Add `.trim()` to admin console password submission (line 1171)
2. Add `.trim()` to backend password storage (line 150)
3. Add `.trim()` to backend password comparison (line 221)

**Current Impact:** Users report "Invalid password" even when entering correct credentials. Blocks Laurence/Damiano onboarding.

---

### 🔴 BUG #2: Plain-Text Password Storage (No Bcrypt)
**Severity:** CRITICAL
**Component:** Database schema + Authentication
**Root Cause:** Passwords stored as plain text. No hashing algorithm. No password salts.

**Evidence:**
- **Registration (line 150):** `INSERT INTO companies (..., admin_password, ...) VALUES (..., body['adminPassword'], ...)`
- **Login (line 221):** `if body['password'] == company['admin_password']:` ← Direct string comparison
- **Super-admin console shows passwords:** Line 1213 displays password in success screen; line 996 displays password in companies table (copy button!)

**Security Risk:** If database is compromised, all admin passwords are immediately exposed. No protection against rainbow tables, brute force, or dictionary attacks.

**Fix Required:**
1. Implement bcrypt hashing for password storage
2. Hash passwords during registration and admin password resets
3. Compare hashed password during login using bcrypt verify
4. Do NOT display passwords in admin console
5. Hide password field in companies list (use "***" or remove entirely)

**Current Impact:** Database breach = all company passwords exposed. Single point of failure for SaaS platform.

---

### 🔴 BUG #3: Missing Password Trimming in Worker Authentication
**Severity:** CRITICAL
**Component:** Worker PIN login
**Root Cause:** Worker PIN not trimmed during creation or comparison.

**Evidence:**
- **Worker creation:** No trimming of `pin` field when created
- **Worker login comparison (line 282):** `pin = ?` direct match against `body['pin']` (not trimmed by frontend)
- **Frontend does trim on line 118:** `const pin = document.getElementById('workerPin').value.trim();`

**Issue:** Same whitespace mismatch as admin password, affecting worker logins.

**Fix Required:** Trim PIN on backend during creation and comparison (both directions).

---

### 🔴 BUG #4: No CSRF Protection on State-Changing Actions
**Severity:** CRITICAL
**Component:** All POST/PUT/DELETE endpoints
**Root Cause:** CORS allows all origins (`*`), no CSRF tokens, no SameSite cookie policy.

**Evidence:**
- **server.py line 26:** `CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)`
- **No CSRF token validation** on any POST/PUT/DELETE endpoint
- **Browser cookies:** Session tokens stored in localStorage (not HttpOnly), immune to CSRF but vulnerable to XSS
- **Frontend:** All API calls use Bearer tokens in headers, not cookies (good), but CORS wildcard is wrong

**Attack Scenario:** Attacker crafts malicious website that makes requests to ledgeman-backend.onrender.com on behalf of logged-in user. Backend accepts requests from any origin.

**Fix Required:**
1. Remove `supports_credentials=True` from CORS (not needed for Bearer auth)
2. Set CORS to specific frontend origins only: `ledgerman.org`, `www.ledgerman.org`
3. Add CSRF token validation to all state-changing endpoints
4. Set `SameSite=Strict` on cookies (if cookies are used)

---

## HIGH-SEVERITY BUGS (Deploy With Caution)

### 🟠 BUG #5: Passwords Visible in Super-Admin Console
**Severity:** HIGH
**Component:** Admin console UI
**Root Cause:** Admin console displays full admin passwords in plain text.

**Evidence:**
- **Success modal (line 1213):** `document.getElementById('createCompanySuccessPassword').value = pwd;` ← Shows password in form field
- **Companies table (line 996):** Displays password as code block with copy button

**Issue:** Even if using bcrypt, revealing passwords on screen defeats the purpose. Passwords should never be displayed in UI after creation.

**Fix Required:**
1. Remove password display from company creation success screen (show only company ID)
2. Remove password column from companies list entirely
3. If password reset needed, send reset link via email instead

---

### 🟠 BUG #6: No Validation of companyName in Admin Login
**Severity:** HIGH
**Component:** Contractor app admin login
**Root Cause:** Case-insensitive lookup but no validation of input format.

**Evidence:**
- **Frontend (line 685):** Trims but doesn't validate
- **Backend (line 209):** `LOWER(name) = LOWER(?)` ← Case-insensitive is good, but accepts any string
- **Attack:** Could try SQL injection via companyName field (though parameterized queries protect against this)

**Issue:** No rate limiting on login attempts. Could enumerate all company names with password guessing.

**Fix Required:**
1. Implement rate limiting on `/api/auth/admin` (max 5 attempts per minute per IP)
2. Add lockout logic (60-second lockout after 5 failed attempts)
3. Log failed login attempts for audit trail

---

### 🟠 BUG #7: Worker PIN Can Be Brute-Forced
**Severity:** HIGH
**Component:** Worker login
**Root Cause:** No rate limiting or lockout on PIN login endpoint.

**Evidence:**
- **Frontend (line 148-150):** Implements 1-minute lockout after 5 attempts (client-side only)
- **Backend:** No rate limiting on `/api/auth/worker`
- **PIN is 4-6 digits:** Only 10,000 possible values; attacker can try all in seconds

**Issue:** Client-side lockout can be bypassed by attacker calling API directly. No server-side protection.

**Fix Required:**
1. Implement server-side rate limiting on PIN login
2. Track failed attempts per company + IP
3. Enforce 60-second lockout after 5 failed attempts
4. Log brute-force attempts for security alerts

---

### 🟠 BUG #8: 2FA TOTP Code Not Properly Validated
**Severity:** HIGH
**Component:** Worker 2FA verification
**Root Cause:** TOTP verification allows ±1 window (90 seconds) which may be too lenient.

**Evidence:**
- **server.py line 378:** `for offset in (-1, 0, 1):` ← Allows past + current + future TOTP windows
- **RFC 6238 spec:** Only current window should be verified

**Issue:** With 90-second window, a captured TOTP code is valid for 90 seconds. Multiple codes can be used in succession.

**Fix Required:**
1. Implement stricter TOTP validation (current window only, or ±0 if strict)
2. Track used TOTP codes per worker to prevent replay attacks
3. Document 2FA limitations in help docs

---

### 🟠 BUG #9: Worker Invites Never Expire
**Severity:** HIGH
**Component:** Worker invite system
**Root Cause:** Invite tokens stored with `expiresAt` field but never validated.

**Evidence:**
- **Backend:** Invite endpoint exists but no expiration validation on `/api/invites/<token>/use`
- **Frontend:** Invitation links work indefinitely

**Issue:** Old invite links remain valid forever. Stale invites can be used to create unauthorized worker accounts.

**Fix Required:**
1. Add expiration validation to `/api/invites/<token>/use` (default 30 days)
2. Implement invite revocation endpoint (admin can cancel invites)
3. Log all invite use/expiration in audit trail

---

## MEDIUM-SEVERITY BUGS

### 🟡 BUG #10: Company Deletion Cascades Without Confirmation
**Severity:** MEDIUM
**Component:** Super-admin console
**Root Cause:** DELETE `/api/superadmin/companies/<id>` deletes company and all related data without soft-delete option.

**Evidence:**
- **Backend:** Hard delete of company row and all entities
- **Frontend:** Confirmation dialog present but no undo mechanism

**Issue:** Deleted data is unrecoverable. No audit trail of what was deleted.

**Fix Required:**
1. Implement soft-delete flag on companies (status='deleted')
2. Hide deleted companies from normal views
3. Allow restoration within 30-day grace period
4. Log deletion with details in audit trail

---

### 🟡 BUG #11: No Rate Limiting on API Endpoints
**Severity:** MEDIUM
**Component:** All API endpoints
**Root Cause:** No middleware implementing request rate limits.

**Evidence:**
- **server.py:** No rate limiting imports or middleware
- **Flask CORS:** No rate limiting headers

**Issue:** DoS attacks possible. Attacker can overwhelm server with requests.

**Fix Required:**
1. Implement Flask-Limiter or similar
2. Set per-IP rate limits: 100 requests/minute for public endpoints, 500 requests/minute for authenticated
3. Return 429 (Too Many Requests) on limit exceeded

---

### 🟡 BUG #12: Photo Uploads Not Validated for Size/Type
**Severity:** MEDIUM
**Component:** Photo upload system
**Root Cause:** `/api/photos` accepts any base64-encoded data without validation.

**Evidence:**
- **Backend:** No file size validation, no MIME type check
- **Frontend:** No client-side validation either

**Issue:** Attacker can upload huge files (DoS) or non-image files, consuming storage and bandwidth.

**Fix Required:**
1. Add file size limit (max 5MB per photo)
2. Validate MIME type (only JPEG, PNG, WebP)
3. Reject or compress oversized uploads
4. Track storage usage per company

---

### 🟡 BUG #13: Worker Data Exposed in Approver Console
**Severity:** MEDIUM
**Component:** Worker submissions list
**Root Cause:** Approver worker can see submissions from all workers, including sensitive data.

**Evidence:**
- **Backend:** Approver has `role='admin'` in JWT, can query all submissions for company
- **Frontend:** Approver page shows all submissions without per-worker filtering

**Issue:** Privacy concern. Workers may see other workers' hours/projects/pay rates.

**Fix Required:**
1. Limit approvers to see only submissions from workers they supervise
2. Add `supervisor_id` field to workers to define approval hierarchy
3. Filter submissions on backend by worker hierarchy

---

### 🟡 BUG #14: No Backup Mechanism for Critical Data
**Severity:** MEDIUM
**Component:** Data persistence
**Root Cause:** SQLite database on Render persistent disk, no automated backups.

**Evidence:**
- **AUDIT.md mentions:** "2:00 AM daily: Ledgerman automated backups" (but no code implements this)
- **Render:** Persistent disk can be lost if dyno fails
- **No backup API endpoint** to export/restore data

**Issue:** If database is corrupted or disk fails, all company data is lost. No recovery mechanism.

**Fix Required:**
1. Implement daily backup export (download database as SQL dump)
2. Store backups in S3 or GitHub releases
3. Implement restore endpoint (admin can restore from backup)
4. Document backup procedure for manual backups

---

## FINDINGS SUMMARY

| Bug ID | Title | Severity | Status | Impact |
|--------|-------|----------|--------|--------|
| #1 | Password whitespace mismatch | CRITICAL | **BLOCKING** | Login failures, customer onboarding blocked |
| #2 | Plain-text password storage | CRITICAL | **BLOCKING** | Database breach = all passwords exposed |
| #3 | Missing PIN trimming | CRITICAL | **BLOCKING** | Worker login failures |
| #4 | No CSRF protection | CRITICAL | **BLOCKING** | API vulnerable to cross-site attacks |
| #5 | Passwords visible in console | HIGH | **FIX SOON** | UI security issue, passwords disclosed |
| #6 | No rate limiting on admin login | HIGH | **FIX SOON** | Allows password enumeration/brute force |
| #7 | Worker PIN brute-forceable | HIGH | **FIX SOON** | Client-side lockout can be bypassed |
| #8 | TOTP validation too lenient | HIGH | **FIX SOON** | 2FA codes valid too long, replay risk |
| #9 | Invites never expire | HIGH | **FIX SOON** | Stale invites create unauthorized accounts |
| #10 | Hard-delete with no undo | MEDIUM | **FIX BEFORE LAUNCH** | Unrecoverable data loss |
| #11 | No rate limiting | MEDIUM | **FIX BEFORE LAUNCH** | DoS vulnerability |
| #12 | Photo upload not validated | MEDIUM | **FIX BEFORE LAUNCH** | Storage abuse, malicious uploads |
| #13 | Worker data exposed to approvers | MEDIUM | **FIX BEFORE LAUNCH** | Privacy concern |
| #14 | No backup mechanism | MEDIUM | **FIX BEFORE LAUNCH** | Data loss risk |

---

## RECOMMENDATION

**DO NOT LAUNCH to production until CRITICAL bugs #1-4 are fixed.** These are blocking issues that prevent core functionality (login) and expose the platform to security attacks.

**Estimated fix time:** 4-6 hours for critical fixes + testing.

---

## Test Coverage Requirements

See `QA_TEST_SCENARIOS.md` for comprehensive test cases covering all bugs and features.
