# LEDGERMAN — COMPLETE QA AUDIT

## PHASE 1: COMPLETE FEATURE INVENTORY

### CONTRACTOR APP (https://ledgerman.org)

#### Authentication & Access Control
1. **Admin Login** - Company name + password
   - Login page displays form with company name, password fields
   - Submit button sends POST /api/auth/admin
   - Valid credentials return JWT, redirect to dashboard
   - Invalid credentials show "Invalid password" error
   - Empty fields blocked from submission
   - 2FA optional for admin (email or authenticator)

2. **Worker PIN Login** - Company name + PIN
   - Separate login screen for workers
   - PIN entry (4-6 digits)
   - Valid PIN returns JWT, redirect to worker dashboard
   - Invalid PIN shows error
   - 2FA optional for workers (TOTP via Google Authenticator)
   - 2FA verification page if enabled

3. **URL-Based Auto-Fill** - Invitation system
   - Login URL with ?company=<name>&password=<pwd> auto-fills and submits
   - Worker URL with ?company=<name>&pin=<pin> auto-fills and submits
   - Missing params show manual login

#### Admin Panel Features

4. **Dashboard**
   - Shows real-time clock-in status for all workers
   - Display: Worker name, clock-in time, duration
   - Manual override: "Clock in/out" button per worker
   - Alerts: Overtime hours, break violations
   - Date selector for historical view

5. **Workers Management**
   - List all active/inactive workers
   - Create new worker: name, PIN, role
   - Edit worker: change PIN, name, role, 2FA settings
   - Delete worker (soft delete - mark inactive)
   - Bulk invite: generate tokens with pre-set company/PIN
   - Toggle 2FA: Email-based or TOTP

6. **Time Entries**
   - View detailed clock-in/out history
   - Edit: change times, add break hours, notes
   - Delete entries
   - Export to CSV
   - Filter by date range, worker, project

7. **Clients** (Company contacts)
   - Create: name, email, phone, address
   - Edit: update all fields
   - Delete
   - List view with contact info
   - Search by name

8. **Projects**
   - Create: name, client, budget, start/end dates
   - Edit: update all fields
   - Delete
   - Budget tracking: vs. actual hours
   - Worker assignment to projects
   - Status: Active/Completed

9. **Expenses**
   - Create: date, vendor, amount, category, notes
   - Edit: change all fields
   - Delete
   - Receipt upload (OCR extraction)
   - Approval workflow: Pending → Approved/Rejected
   - Filter by project, vendor, status
   - Reports: vendor breakdown, category breakdown

10. **Vendors**
    - Create: name, contact, email, address
    - Edit: update info
    - Delete
    - Track: total spent, last purchase date
    - List view with summary

11. **Invoices**
    - Generate from project
    - Manual creation
    - Include: hours, expenses, deposits, taxes
    - PDF export
    - Email to client
    - Mark as paid

12. **Settings** (Admin)
    - Company name, logo, address
    - Admin password change
    - Email configuration (for password reset)
    - 2FA settings
    - Tax rate, currency
    - Report preferences

13. **Photos/Attachments**
    - Upload photos to projects, time entries, expenses
    - View gallery
    - Download original
    - Delete

14. **Reports**
    - Employee hours report (by date range, per employee)
    - Project profitability
    - Expense summary
    - Revenue forecasting

15. **Help System**
    - 5 tabs: Getting Started, Time Entry, Expenses, Invoicing, Troubleshooting
    - Tooltips on form fields
    - FAQ expandable sections
    - Email support link

#### Navigation & UI
16. **Top Navigation** - Burger menu (mobile) / full nav (desktop)
    - Menu items: Dashboard, Workers, Time, Clients, Projects, Expenses, Invoices, Reports, Settings, Help
    - Logout button
    - User name display

17. **Mobile Responsiveness**
    - All forms optimized for touch
    - Menu collapses to hamburger on mobile
    - Forms stack vertically
    - Buttons full-width on mobile
    - Readable text (≥16px on input fields)

---

### SUPER ADMIN CONSOLE (https://admin.ledgerman.org)

#### Authentication
1. **Super Admin Login**
   - Enter super admin key (32-byte hex string)
   - Click "Access Console" button
   - Valid key returns JWT, loads dashboard
   - Invalid key shows error

#### Super Admin Functions
2. **Company Management**
   - List all companies: name, admin email, creation date, worker count
   - Create new company: name, admin password
   - Edit company: name, admin password (if locked, double-confirm)
   - Delete company: confirm dialog
   - View stats: total companies, revenue, workers

3. **Company Details**
   - Company name, creation date
   - Admin password (hidden, change-only)
   - Current worker count
   - Active projects count
   - Total revenue
   - Database size

4. **Invite Management**
   - Generate invite link: pre-fill company + credentials
   - Email template: HTML + plain text
   - Copy link to clipboard
   - Open in email client
   - Branded with company logo + colors

5. **System Monitoring**
   - Database status
   - Backup status
   - API health
   - Recent errors log
   - Performance metrics

---

## PHASE 2: KNOWN CODE ISSUES (PRE-TESTING)

### CRITICAL BUGS

1. **Plain-Text Password Storage**
   - **Location:** server.py line 195 (auth_admin function)
   - **Issue:** `body['password'] == company['admin_password']` (no bcrypt, plain text comparison)
   - **Impact:** Any breach exposes all admin passwords; whitespace/encoding mismatches cause "invalid password" errors
   - **Status:** UNFIXED (not in requirements but IS a security vulnerability)
   - **Test:** Try login with extra spaces

2. **Mobile Caching - Stale UI**
   - **Location:** Render Static Site cache policy
   - **Issue:** Mobile browsers cache Ledgerman UI. Cache headers insufficient (max-age=0 not effective)
   - **Impact:** Users see old UI versions, features don't update, forms broken
   - **Status:** UNFIXED
   - **Test:** Clear cache on mobile, reload, verify UI current

3. **Missing Cache-Busting Headers**
   - **Location:** admin.html, index.html deployed to Render
   - **Issue:** No Cache-Control: no-cache or ETag headers
   - **Impact:** Mobile browsers serve stale code despite server updates
   - **Status:** UNFIXED
   - **Test:** Deploy new code, check if mobile sees it immediately

4. **Error Handling: 403 as "connection failure"**
   - **Location:** app.js apiFetch() function
   - **Issue:** HTTP 403 (Forbidden) displayed as generic "connection failure"
   - **Impact:** Users can't distinguish auth errors from network errors
   - **Status:** UNFIXED
   - **Test:** Try accessing admin features as worker

5. **Password Trimming Issue (PARTIAL FIX)**
   - **Location:** app.js login handlers
   - **Issue:** `.trim()` added to password fields (commit 3004816), but not validated comprehensively
   - **Impact:** Special characters, spaces, encoding issues may still cause mismatches
   - **Status:** PARTIALLY FIXED (2026-03-22)
   - **Test:** Login with password containing spaces, special chars, unicode

6. **Form Save - No Validation Feedback**
   - **Location:** Admin console company edit (admin.html)
   - **Issue:** saveDetailEdit() shows generic "Saving..." message, but doesn't indicate what failed
   - **Impact:** Users don't know if save succeeded (Lucas reported save error 2026-03-22)
   - **Status:** UNFIXED
   - **Test:** Try editing company name, watch for error message

7. **deleteCompany() - JS Exception Handling**
   - **Location:** ledgerman-admin/admin.html deleteCompany()
   - **Issue:** Missing catch block in async function (commit 05a9647 attempted fix)
   - **Impact:** Unhandled promise rejection if delete fails
   - **Status:** ATTEMPTED FIX (verify in testing)
   - **Test:** Try deleting company with active workers/data

---

### MEDIUM PRIORITY ISSUES

8. **Login State Persistence**
   - **Issue:** JWT stored in localStorage; no session timeout
   - **Impact:** Token valid until manual logout (infinite session)
   - **Test:** Log in, close browser, reopen → still logged in?

9. **Worker Assignment**
   - **Issue:** Workers can clock in but unclear if assigned to projects
   - **Impact:** May clock into unassigned projects
   - **Test:** Clock in as worker, verify project assignment

10. **2FA Backup Codes**
    - **Issue:** No backup codes for 2FA (TOTP only)
    - **Impact:** If user loses authenticator, no recovery path
    - **Test:** Disable 2FA, verify no recovery codes required

11. **Photo Uploads - Size Limits**
    - **Issue:** No max file size enforced on photo upload
    - **Impact:** Could upload huge images, crash server
    - **Test:** Upload 100MB file

12. **Expense Approval Workflow**
    - **Issue:** Not clear who can approve (admin only? Approver role?)
    - **Test:** Create expense as approver role, try to approve own expense

---

## PHASE 3: TEST SCENARIOS (BY FEATURE)

### SCENARIO FORMAT
```
Feature: [Name]
Test Case: [Description]
Steps:
  1. [Action]
  2. [Action]
  3. [Action]
Expected: [Result]
Actual: [Will fill after testing]
Pass/Fail: [Will fill after testing]
Bug Found: [If any]
```

---

### CORE AUTHENTICATION TESTS

#### Test: AC-001 - Admin Login - Valid Credentials
```
Feature: Admin Login
Test Case: Valid company name + password
Steps:
  1. Navigate to https://ledgerman.org
  2. Select Admin tab
  3. Enter company: "Belfort Con"
  4. Enter password: "Admin123456!"
  5. Click Login
Expected: JWT token issued, dashboard loads with company data
```

#### Test: AC-002 - Admin Login - Invalid Password
```
Feature: Admin Login
Test Case: Correct company, wrong password
Steps:
  1. Navigate to https://ledgerman.org
  2. Select Admin tab
  3. Enter company: "Belfort Con"
  4. Enter password: "WrongPassword"
  5. Click Login
Expected: Error message "Invalid password"
```

#### Test: AC-003 - Admin Login - Company Not Found
```
Feature: Admin Login
Test Case: Non-existent company
Steps:
  1. Navigate to https://ledgerman.org
  2. Select Admin tab
  3. Enter company: "NonexistentCo"
  4. Enter password: "anypassword"
  5. Click Login
Expected: Error message "Company not found"
```

#### Test: AC-004 - Admin Login - Empty Fields
```
Feature: Admin Login
Test Case: Missing company or password
Steps:
  1. Navigate to https://ledgerman.org
  2. Select Admin tab
  3. Leave company empty
  4. Click Login
Expected: Form validation error, login not sent
```

#### Test: AC-005 - URL Auto-Fill - Admin
```
Feature: URL Auto-Fill (Invitations)
Test Case: Auto-fill admin credentials from URL
Steps:
  1. Navigate to: https://ledgerman.org?company=Belfort%20Con&password=Admin123456!
  2. Wait 2 seconds
Expected: Form auto-filled, auto-submitted, dashboard loads
```

#### Test: AC-006 - URL Auto-Fill - Worker
```
Feature: URL Auto-Fill (Invitations)
Test Case: Auto-fill worker PIN from URL
Steps:
  1. Create a test worker with PIN "1234"
  2. Navigate to: https://ledgerman.org?company=Belfort%20Con&pin=1234
  3. Wait 2 seconds
Expected: Form auto-filled, auto-submitted, worker dashboard loads
```

#### Test: AC-007 - Worker Login - Valid PIN
```
Feature: Worker PIN Login
Test Case: Valid worker PIN
Steps:
  1. Navigate to https://ledgerman.org
  2. Select Worker tab
  3. Enter company: "Belfort Con"
  4. Enter PIN: [worker PIN from setup]
  5. Click Login
Expected: JWT issued, worker dashboard shows time entry screen
```

#### Test: AC-008 - Worker Login - Invalid PIN
```
Feature: Worker PIN Login
Test Case: Wrong PIN
Steps:
  1. Navigate to https://ledgerman.org
  2. Select Worker tab
  3. Enter company: "Belfort Con"
  4. Enter PIN: "9999"
  5. Click Login
Expected: Error "Invalid PIN or worker not active"
```

#### Test: AC-009 - 2FA Email - Admin
```
Feature: 2FA (Email-based)
Test Case: Admin with 2FA enabled
Steps:
  1. Enable 2FA in settings (email method)
  2. Log out
  3. Log in with company name + password
  4. Check email for 2FA code
  5. Enter code on 2FA page
Expected: Dashboard loads after code verified
```

#### Test: AC-010 - 2FA TOTP - Worker
```
Feature: 2FA (TOTP)
Test Case: Worker with TOTP enabled
Steps:
  1. Set up worker 2FA (Google Authenticator)
  2. Log out
  3. Log in with company + PIN
  4. Scan QR code in browser (or enter secret)
  5. Enter 6-digit code
Expected: Worker dashboard loads
```

#### Test: AC-011 - Logout
```
Feature: Logout
Test Case: User logout
Steps:
  1. Log in as admin
  2. Click "Logout" button
  3. Check localStorage for JWT
Expected: JWT deleted, redirect to login page
```

#### Test: AC-012 - Session Persistence
```
Feature: Session Persistence
Test Case: JWT persists across browser refresh
Steps:
  1. Log in as admin
  2. Refresh page (F5)
  3. Observe dashboard
Expected: User remains logged in (JWT from localStorage)
```

#### Test: AC-013 - Token Expiration (IF IMPLEMENTED)
```
Feature: Token Expiration
Test Case: Old JWT rejected after expiration
Steps:
  1. Log in
  2. Wait [token expiration time] (if configured)
  3. Try to use expired JWT
Expected: 401 response, forced re-login
Note: If no expiration is set, this is a security issue
```

---

### ADMIN DASHBOARD TESTS

#### Test: DB-001 - Dashboard Load
```
Feature: Admin Dashboard
Test Case: Load dashboard
Steps:
  1. Log in as admin
  2. Observe dashboard
Expected: Real-time worker status table loads, shows all workers, clock-in times
```

#### Test: DB-002 - Dashboard Real-Time Update
```
Feature: Admin Dashboard
Test Case: Real-time sync when worker clocks in
Steps:
  1. Log in as admin
  2. In another window, log in as worker
  3. Worker clicks "Clock In"
  4. Observe admin dashboard
Expected: Dashboard updates within 5 seconds, shows new clock-in
```

#### Test: DB-003 - Manual Clock In/Out Override
```
Feature: Admin Dashboard
Test Case: Admin manually clock in worker
Steps:
  1. Log in as admin
  2. Click worker's "Clock In" button
  3. Confirm dialog appears
  4. Confirm action
Expected: Worker clocked in, timestamp recorded
```

#### Test: DB-004 - Dashboard Date Selection
```
Feature: Admin Dashboard
Test Case: View historical data by date
Steps:
  1. Log in as admin
  2. Select date picker, choose past date
  3. Observe workers for that date
Expected: Dashboard shows data for selected date
```

---

### WORKERS MANAGEMENT TESTS

#### Test: WM-001 - Create Worker
```
Feature: Workers Management
Test Case: Create new worker
Steps:
  1. Log in as admin
  2. Navigate to Workers
  3. Click "Add Worker"
  4. Enter: name="John Doe", PIN="1234", role="Laborer"
  5. Click Save
Expected: Worker created, appears in list, worker receives invite email
```

#### Test: WM-002 - Create Worker - Invalid PIN (Non-numeric)
```
Feature: Workers Management
Test Case: PIN validation
Steps:
  1. Log in as admin
  2. Navigate to Workers → Add Worker
  3. Enter name, PIN="abc" (non-numeric)
  4. Click Save
Expected: Error "PIN must be numeric"
```

#### Test: WM-003 - Edit Worker
```
Feature: Workers Management
Test Case: Change worker PIN
Steps:
  1. Log in as admin
  2. Navigate to Workers
  3. Click worker, edit PIN "1234" → "5678"
  4. Click Save
Expected: PIN updated, old PIN no longer works
```

#### Test: WM-004 - Delete Worker
```
Feature: Workers Management
Test Case: Delete worker (soft delete)
Steps:
  1. Log in as admin
  2. Navigate to Workers
  3. Click worker, delete
  4. Confirm dialog
Expected: Worker marked inactive, no longer in active list
```

#### Test: WM-005 - Bulk Invite
```
Feature: Workers Management
Test Case: Generate invitation tokens
Steps:
  1. Log in as admin
  2. Navigate to Workers
  3. Click "Bulk Invite"
  4. Select workers, generate links
  5. Copy link (auto-filled credentials)
Expected: Link like ledgerman.org?company=X&pin=Y generated and copyable
```

#### Test: WM-006 - Worker Activation Link
```
Feature: Workers Management
Test Case: First-time worker setup via invite
Steps:
  1. Receive invite link: ledgerman.org?company=Belfort%20Con&pin=1234
  2. Click link
  3. Form auto-filled, auto-submitted
  4. Worker can set optional 2FA
Expected: Worker account activated, can log in
```

#### Test: WM-007 - Worker 2FA Setup
```
Feature: Workers Management
Test Case: Enable TOTP 2FA
Steps:
  1. Log in as admin
  2. Navigate to Workers → Edit worker
  3. Click "Enable 2FA" → "Google Authenticator"
  4. Scan QR code (or copy secret)
  5. Click Save
Expected: 2FA enabled, next worker login requires TOTP code
```

---

### TIME ENTRY TESTS

#### Test: TE-001 - Clock In
```
Feature: Time Entry - Clock In
Test Case: Worker clock in
Steps:
  1. Log in as worker
  2. Click "Clock In"
  3. Confirm dialog
Expected: Clock-in timestamp recorded, dashboard shows "Clocked In"
```

#### Test: TE-002 - Clock Out
```
Feature: Time Entry - Clock Out
Test Case: Worker clock out
Steps:
  1. Log in as worker (already clocked in)
  2. Click "Clock Out"
  3. Confirm dialog
Expected: Clock-out timestamp recorded, hours calculated
```

#### Test: TE-003 - Clock Rounding
```
Feature: Time Entry - Rounding
Test Case: 15-minute rounding on timestamps
Steps:
  1. Admin clock in at 10:07 AM
  2. Admin clock out at 11:23 AM
Expected: Rounded to nearest 15 min: 10:00 → 11:15 (or 10:15 → 11:30 depending on rounding rules)
```

#### Test: TE-004 - Edit Time Entry
```
Feature: Time Entry - Edit
Test Case: Admin edit worker's time entry
Steps:
  1. Log in as admin
  2. Navigate to Time Entries
  3. Click entry, edit: change clock-in time to 10:00 AM
  4. Click Save
Expected: Timestamp updated, hours recalculated
```

#### Test: TE-005 - Delete Time Entry
```
Feature: Time Entry - Delete
Test Case: Delete time entry
Steps:
  1. Log in as admin
  2. Navigate to Time Entries
  3. Click entry, delete
  4. Confirm dialog
Expected: Entry removed, hours recalculated for day
```

#### Test: TE-006 - Overtime Detection
```
Feature: Time Entry - Overtime Detection
Test Case: Alert on hours >40/week
Steps:
  1. Clock in multiple workers for 60+ hours in a week
  2. Observe dashboard
Expected: Overtime alert displayed for workers >40 hours
```

#### Test: TE-007 - Break Tracking
```
Feature: Time Entry - Breaks
Test Case: Record lunch/break
Steps:
  1. Log in as admin, view worker's time entry
  2. Enter break duration: 30 minutes
  3. Save
Expected: Hours calculated as: (Clock Out - Clock In) - Break
```

#### Test: TE-008 - Project Assignment in Time Entry
```
Feature: Time Entry - Project Assignment
Test Case: Clock in to specific project
Steps:
  1. Log in as worker
  2. Clock In → Select Project
  3. Choose project from dropdown
  4. Confirm
Expected: Clock-in recorded against project, hours track to project budget
```

---

### EXPENSE TESTS

#### Test: EX-001 - Create Expense
```
Feature: Expenses - Create
Test Case: Create new expense
Steps:
  1. Log in as admin
  2. Navigate to Expenses
  3. Click "Add Expense"
  4. Enter: date=today, vendor="Home Depot", amount=150.00, category="Materials"
  5. Click Save
Expected: Expense created, appears in list, assigned to company
```

#### Test: EX-002 - Expense Receipt Upload (OCR)
```
Feature: Expenses - OCR
Test Case: Upload receipt image
Steps:
  1. Log in as admin
  2. Navigate to Expenses → Add Expense
  3. Upload receipt image (JPEG/PNG)
  4. Click "Extract with OCR"
Expected: Moondream extracts: vendor, date, amount, tax → auto-fill form
Note: Requires Ollama running locally on port 11434
```

#### Test: EX-003 - Expense Approval
```
Feature: Expenses - Approval Workflow
Test Case: Approval state change
Steps:
  1. Log in as admin
  2. Navigate to Expenses
  3. Click expense → "Approve"
  4. Confirm
Expected: Status changed to "Approved", expense eligible for invoicing
```

#### Test: EX-004 - Expense Rejection
```
Feature: Expenses - Approval
Test Case: Reject expense
Steps:
  1. Log in as admin
  2. Navigate to Expenses
  3. Click expense → "Reject"
  4. Enter reason (optional)
  5. Confirm
Expected: Status changed to "Rejected", expense removed from invoicing pipeline
```

#### Test: EX-005 - Expense Filter by Project
```
Feature: Expenses - Filter
Test Case: Filter expenses by project
Steps:
  1. Log in as admin
  2. Navigate to Expenses
  3. Select project filter
  4. Observe list
Expected: Only expenses for selected project shown
```

#### Test: EX-006 - Expense Category Breakdown Report
```
Feature: Expenses - Reporting
Test Case: Generate category breakdown
Steps:
  1. Log in as admin
  2. Navigate to Reports → Expenses
  3. View category breakdown
Expected: Chart/table shows: Materials=$500, Labor=$1200, Other=$300
```

---

### INVOICING TESTS

#### Test: IN-001 - Generate Invoice from Project
```
Feature: Invoicing - Generate
Test Case: Create invoice from project hours + expenses
Steps:
  1. Log in as admin
  2. Navigate to Invoices
  3. Click "Generate from Project"
  4. Select project, date range
  5. Confirm
Expected: Invoice created with:
  - Client name
  - Line items: hours (qty × rate) + expenses
  - Subtotal, tax, total
  - Invoice number + date
```

#### Test: IN-002 - Manual Invoice Creation
```
Feature: Invoicing - Manual Create
Test Case: Manually create invoice
Steps:
  1. Log in as admin
  2. Navigate to Invoices
  3. Click "Create Manual Invoice"
  4. Select client, enter line items
  5. Click Save
Expected: Invoice created, PDF preview available
```

#### Test: IN-003 - Invoice PDF Export
```
Feature: Invoicing - PDF Export
Test Case: Download invoice as PDF
Steps:
  1. Log in as admin
  2. Navigate to Invoices
  3. Click invoice → "Download PDF"
Expected: PDF file downloaded, contains all invoice details, professionally formatted
```

#### Test: IN-004 - Invoice Email to Client
```
Feature: Invoicing - Email
Test Case: Email invoice to client
Steps:
  1. Log in as admin
  2. Navigate to Invoices
  3. Click invoice → "Email to Client"
  4. Confirm
Expected: Email sent to client with PDF attachment, confirmation message
```

#### Test: IN-005 - Mark Invoice as Paid
```
Feature: Invoicing - Paid Status
Test Case: Record invoice payment
Steps:
  1. Log in as admin
  2. Navigate to Invoices
  3. Click invoice → "Mark Paid"
  4. Enter payment date + amount
  5. Confirm
Expected: Invoice status changed to "Paid", date recorded
```

#### Test: IN-006 - Deposit/Retainer
```
Feature: Invoicing - Deposits
Test Case: Record deposit against invoice
Steps:
  1. Log in as admin
  2. Navigate to Invoices
  3. Click invoice → "Record Deposit"
  4. Enter amount, date
  5. Confirm
Expected: Deposit applied, invoice balance updated
```

---

### CLIENTS & PROJECTS TESTS

#### Test: CL-001 - Create Client
```
Feature: Clients - Create
Test Case: Create new client
Steps:
  1. Log in as admin
  2. Navigate to Clients
  3. Click "Add Client"
  4. Enter: name="John Smith", email="john@example.com", phone="555-1234", address="123 Main St"
  5. Click Save
Expected: Client created, appears in list
```

#### Test: CL-002 - Edit Client
```
Feature: Clients - Edit
Test Case: Update client info
Steps:
  1. Log in as admin
  2. Navigate to Clients
  3. Click client, edit email → "john.smith@example.com"
  4. Click Save
Expected: Client email updated
```

#### Test: CL-003 - Delete Client
```
Feature: Clients - Delete
Test Case: Delete client
Steps:
  1. Log in as admin
  2. Navigate to Clients
  3. Click client → Delete
  4. Confirm (should warn if projects exist)
Expected: Client deleted or warning shown if linked data exists
```

#### Test: PR-001 - Create Project
```
Feature: Projects - Create
Test Case: Create new project
Steps:
  1. Log in as admin
  2. Navigate to Projects
  3. Click "Add Project"
  4. Enter: name="Kitchen Remodel", client="John Smith", budget=5000, start=today, end=30 days
  5. Click Save
Expected: Project created, appears in list, budget tracking initialized
```

#### Test: PR-002 - Edit Project
```
Feature: Projects - Edit
Test Case: Update project info
Steps:
  1. Log in as admin
  2. Navigate to Projects
  3. Click project, edit budget: 5000 → 6000
  4. Click Save
Expected: Budget updated
```

#### Test: PR-003 - Delete Project
```
Feature: Projects - Delete
Test Case: Delete project
Steps:
  1. Log in as admin
  2. Navigate to Projects
  3. Click project → Delete
  4. Confirm (should warn if time entries exist)
Expected: Project deleted or warning shown
```

#### Test: PR-004 - Budget Tracking
```
Feature: Projects - Budget
Test Case: Track project profitability
Steps:
  1. Create project with $5000 budget
  2. Log 50 hours of work @ $50/hour = $2500
  3. Add $1500 in expenses
  4. Observe project
Expected: Shows: Budget $5000, Spent $4000, Remaining $1000
```

---

### SETTINGS TESTS

#### Test: ST-001 - Edit Company Name
```
Feature: Settings - Company Info
Test Case: Update company name
Steps:
  1. Log in as admin
  2. Navigate to Settings
  3. Edit Company Name: "Belfort Con" → "Belfort Construction"
  4. Click Save
Expected: Company name updated, reflected everywhere
```

#### Test: ST-002 - Change Admin Password
```
Feature: Settings - Security
Test Case: Change admin password
Steps:
  1. Log in as admin
  2. Navigate to Settings → Security
  3. Enter current password, new password, confirm
  4. Click Save
  5. Log out
  6. Log in with new password
Expected: Login succeeds with new password, fails with old password
```

#### Test: ST-003 - Password Reset via Email
```
Feature: Settings - Password Reset
Test Case: Reset forgotten password
Steps:
  1. Log out
  2. Go to login page
  3. Click "Forgot Password"
  4. Enter company name
  5. Check email for reset link
  6. Click link, set new password
Expected: Password reset, can log in with new password
```

#### Test: ST-004 - Enable 2FA (Admin)
```
Feature: Settings - 2FA
Test Case: Set up email 2FA
Steps:
  1. Log in as admin
  2. Navigate to Settings → Security → 2FA
  3. Select "Email"
  4. Save
  5. Log out, log back in
Expected: 2FA code sent to email, must enter to proceed
```

#### Test: ST-005 - Tax Rate Configuration
```
Feature: Settings - Tax
Test Case: Set company tax rate
Steps:
  1. Log in as admin
  2. Navigate to Settings
  3. Set tax rate: 13%
  4. Save
Expected: Tax applied to all future invoices (13% of subtotal)
```

---

### SUPER ADMIN CONSOLE TESTS

#### Test: SA-001 - Super Admin Login
```
Feature: Super Admin Console - Login
Test Case: Enter super admin key
Steps:
  1. Navigate to https://admin.ledgerman.org
  2. Enter key: "ef569056f9803b13e66070aed163d4fe0d660e245b4c50a8c56d55e66af54020"
  3. Click "Access Console"
Expected: Dashboard loads, shows company list
```

#### Test: SA-002 - Create Company
```
Feature: Super Admin Console - Create Company
Test Case: Create new company
Steps:
  1. Log in to super admin
  2. Click "Create Company"
  3. Enter name="Test Contractor", password="TempPassword123!"
  4. Click Save
Expected: Company created, appears in list, admin can log in with credentials
```

#### Test: SA-003 - Edit Company
```
Feature: Super Admin Console - Edit
Test Case: Edit company details
Steps:
  1. Log in to super admin
  2. Click company → Edit
  3. Change name: "Test Contractor" → "Updated Contractor"
  4. Double-confirm if locked
  5. Save
Expected: Company name updated
```

#### Test: SA-004 - Delete Company
```
Feature: Super Admin Console - Delete
Test Case: Delete company
Steps:
  1. Log in to super admin
  2. Click company → Delete
  3. Confirm dialog
  4. Confirm again (destructive action)
Expected: Company deleted, no longer in list
```

#### Test: SA-005 - Generate Invite
```
Feature: Super Admin Console - Invites
Test Case: Generate invite link with pre-filled credentials
Steps:
  1. Log in to super admin
  2. Click company → Invite
  3. Generate invite link
  4. Copy link
Expected: Link like ledgerman-frontend.onrender.com?company=TestCo&password=X generated
```

#### Test: SA-006 - Company Stats
```
Feature: Super Admin Console - Stats
Test Case: View company statistics
Steps:
  1. Log in to super admin
  2. Click company → Details
  3. View: worker count, active projects, revenue, database size
Expected: Stats displayed correctly
```

#### Test: SA-007 - System Health Check
```
Feature: Super Admin Console - Monitoring
Test Case: Check system status
Steps:
  1. Log in to super admin
  2. Navigate to Health/Diagnostics
  3. View: database status, API health, backup timestamp
Expected: All systems show green (OK status)
```

---

### MOBILE-SPECIFIC TESTS

#### Test: MO-001 - Mobile Responsiveness
```
Feature: Mobile - Responsive Design
Test Case: All screens fit on mobile
Steps:
  1. Open app on iPhone (375x667 or equivalent)
  2. Navigate through all pages
  3. Tap all buttons, forms
Expected: No horizontal scroll, buttons clickable, text readable (≥16px)
```

#### Test: MO-002 - Touch Gestures
```
Feature: Mobile - Touch
Test Case: Swipe navigation (if implemented)
Steps:
  1. Open app on phone
  2. Swipe left/right between screens
Expected: Navigation works, smooth animation
```

#### Test: MO-003 - Mobile Camera (Photo Upload)
```
Feature: Mobile - Camera
Test Case: Take photo directly from camera
Steps:
  1. Open app on phone
  2. Upload photo → Select "Camera"
  3. Take photo
Expected: Photo captured, uploaded to expense/project
```

#### Test: MO-004 - Offline Support (IF IMPLEMENTED)
```
Feature: Mobile - Offline
Test Case: App works without internet
Steps:
  1. Log in on mobile
  2. Disable WiFi + cellular
  3. Try to clock in/out
Expected: If offline-first: queued until online. If not: error message
```

#### Test: MO-005 - Cache Clearing
```
Feature: Mobile - Cache
Test Case: Mobile cache doesn't block updates
Steps:
  1. Log in on iPhone
  2. Deploy new code on server
  3. On phone: Settings → Safari → Clear History & Website Data
  4. Reload app
Expected: New UI version loads (not cached old version)
```

---

### SECURITY TESTS

#### Test: SEC-001 - SQL Injection Protection
```
Feature: Security - SQL Injection
Test Case: SQL injection in company name field
Steps:
  1. Navigate to login
  2. Company name: "' OR '1'='1"
  3. Enter password
  4. Try to login
Expected: Query is parameterized, no SQL injection occurs
```

#### Test: SEC-002 - XSS Protection
```
Feature: Security - XSS
Test Case: JavaScript injection in form fields
Steps:
  1. Log in as admin
  2. Create expense: vendor="<script>alert('XSS')</script>"
  3. Submit
Expected: Script not executed, stored as text, escaped when displayed
```

#### Test: SEC-003 - CSRF Protection
```
Feature: Security - CSRF
Test Case: Cross-site form submission
Steps:
  1. Log in to app
  2. Open malicious site that tries to POST to /api/expenses
  3. Observe
Expected: Request blocked (origin mismatch, CORS headers)
```

#### Test: SEC-004 - Rate Limiting
```
Feature: Security - Rate Limiting
Test Case: Brute force login attempts
Steps:
  1. Try to login 10+ times with wrong password rapidly
  2. Observe
Expected: After N attempts (e.g., 5), rate limited with 429 response
```

#### Test: SEC-005 - Unauthorized Access
```
Feature: Security - Authorization
Test Case: Worker accesses admin panel
Steps:
  1. Log in as worker
  2. Try to access /admin directly
  3. Try to call /api/workers POST (create worker)
Expected: 401 Unauthorized or redirect to worker dashboard
```

#### Test: SEC-006 - Data Isolation
```
Feature: Security - Multi-Tenant Isolation
Test Case: Company A can't see Company B data
Steps:
  1. Log in as Company A admin
  2. Manually modify JWT to Company B's ID
  3. Try to fetch /api/sync
Expected: Only Company A data returned (server validates company_id)
```

#### Test: SEC-007 - Password Hashing
```
Feature: Security - Password Storage
Test Case: Verify passwords are hashed
Steps:
  1. Log in as admin, check database
  2. Inspect admin_password column
Expected: Passwords are bcrypt hashed (start with $2b$), not plain text
Note: Currently failing — passwords stored in plain text
```

#### Test: SEC-008 - Audit Logging
```
Feature: Security - Audit Logs
Test Case: User actions logged
Steps:
  1. Log in as admin
  2. Create/edit/delete entities
  3. Check /api/audit endpoint
Expected: All actions logged with timestamp, user, action, result
```

---

## PHASE 4: PLAYWRIGHT E2E TESTS

See ledgerman-e2e-tests.js
