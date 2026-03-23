# Tasks — Ledgerman

## Priority 1 (Do Now / Waiting on User)

- [ ] **Laurence/Damiano: Browser test Tier 2 features** — Test at https://ledgerman.org: login → Projects → create project → create task → upload photo. Report results.
  - **Blockers:** Requires user action
  - **Depends on:** Nothing (ready now)
  - **Impact:** QA gate for Tier 2 completion

- [ ] **Diagnose Tier 2 issues (if test fails)** — If Laurence/Damiano report failures, diagnose root cause (photo upload form mismatch, entity naming bug, missing endpoints, UI rendering issue, etc.)
  - **Blockers:** None until test happens
  - **Depends on:** User test results
  - **Impact:** Fix blockers before Tier 3

## Priority 2 (Do Soon)

- [ ] **Tier 3: Task assignment to workers** — Extend Tasks module to support assigning tasks to specific workers, with status tracking (not-started, in-progress, complete)
  - **Blockers:** Tier 2 user acceptance testing
  - **Depends on:** Tier 2 QA verified
  - **Impact:** Workers can see assigned tasks on dashboard

- [ ] **Tier 3: Budget tracking** — Add budget field to projects, cost field to tasks, calculate actual vs. budgeted
  - **Blockers:** Tier 2 user acceptance testing
  - **Depends on:** Tier 2 QA verified
  - **Impact:** Cost forecasting for project ROI

- [ ] **Tier 3: Gantt charts & critical path** — Visualize project timeline, dependencies, and critical path
  - **Blockers:** Tier 2 user acceptance testing
  - **Depends on:** Tier 2 QA verified
  - **Impact:** Project managers see schedule visibility

- [ ] **Tier 3: Daily reports & punch lists** — Auto-generate daily reports from tasks, punch lists from incomplete items
  - **Blockers:** Tier 2 user acceptance testing
  - **Depends on:** Tier 2 QA verified
  - **Impact:** Administrative reporting automation

## Priority 3 (Backlog)

- [ ] **Tier 3+: Invoicing from projects** — Auto-draft invoices from project completion + task breakdowns
  - **Impact:** Accounting workflow acceleration
  - **Dependencies:** All task/budget features

- [ ] **Phase 4: PostgreSQL migration** — Scale beyond SQLite for multi-tenant growth
  - **Impact:** Scalability for 100+ companies
  - **Timeline:** Post-MVP (Q2 2026)

- [ ] **Phase 4: S3 photo storage** — Move photos from local/render disk to AWS S3
  - **Impact:** Bandwidth, durability, multi-region resilience
  - **Timeline:** Post-MVP (Q2 2026)

- [ ] **Phase 4: Stripe billing integration** — Auto-subscribe companies at $25/month
  - **Impact:** Revenue automation, subscription management
  - **Timeline:** Post-MVP (Q2 2026)

## Completed

- [x] **Tier 1: Security hardening** — All 5 critical vulnerabilities patched (password strength, brute force, photo limits, CORS, exception disclosure) — Completed 2026-03-22
- [x] **Module system** — 22 pre-registered modules (Invoicing, 2FA, OCR, GPS, etc.) + custom module support — Completed 2026-03-22
- [x] **Projects CRUD backend** — Create, read, update, delete projects via API — Completed 2026-03-22
- [x] **Tasks CRUD backend** — Create, read, update, delete tasks (subtasks) via API — Completed 2026-03-22
- [x] **Photo upload backend** — Upload photos, link to projects, retrieve via API — Completed 2026-03-22
- [x] **Frontend code for Tier 2** — projects.js, photos.js, dashboard integration complete — Completed 2026-03-22
- [x] **Deployment to Render** — All services deployed and live (backend HTTP 200, frontend responsive) — Completed 2026-03-22

---

## Key Decisions

**2026-03-22 — Tier 2 features built, but QA verification deferred to users**
- Reason: Backend APIs verified working via curl, but UI rendering cannot be verified without browser access
- Decision: Build all code, deploy to production, but mark as "feature-complete, QA-unverified"
- Next: Laurence/Damiano test in real browser; if issues found, diagnose and fix from failure reports
- Standard: All subsequent features will follow QA-first (test after every build)
