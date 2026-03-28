# Ledgerman — Construction Management SaaS

## Goal
Multi-tenant construction management platform. Primary revenue: $25/month per company. Current focus: Tier 1 & 2 complete (web), Tier 3 planning + Android mobile expansion.

## Design Intent
Web-based SaaS for small-to-mid construction companies. Track projects, tasks, time, expenses, photos, payroll. Eventually: mobile app for job-site access (native Android via Google Play).

## Current Implementation

### Web Platform (Tier 1 & 2) ✅ LIVE
- **Frontend:** Vue.js + Bootstrap 5
- **Backend:** Python Flask + SQLite
- **Features Deployed:** User auth (Bcrypt), 22+ custom modules, worker 3-field login, time entry with photos, project/task CRUD, expense tracking, photo gallery, invite/onboard flow
- **Status:** Production-ready, Tier 1 & 2 verified by QA

### Mobile Expansion (Android via React Native) 🚀 IN PROGRESS
- **Framework:** React Native (Expo) + TypeScript
- **Phase 1 ✅:** Project scaffold, TypeScript config, API service layer, folder structure
- **Phase 2 ✅:** PIN login screen, Dashboard, Time Entry screen
- **Phase 3 (Next):** Photo upload, Projects/Tasks screens, persistent auth
- **Phase 4:** Android build, Google Play signing and submission
- **Target:** Publish to Google Play Q2 2026

## Timeline & Phasing

### Phase 1: Web Platform (Complete)
- Duration: 6 months (2025-2026)
- Status: COMPLETE — Tier 1 & 2 live in production

### Phase 2: Android Mobile Development (Current)
- Duration: 8 weeks (March-May 2026)
- Week 1-2: Architecture + core screens (✅ DONE: login, dashboard, time entry)
- Week 3-4: Photo + Projects/Tasks screens
- Week 5-6: Android build config + signing
- Week 7-8: Google Play submission + initial release
- Timeline: On track for Q2 2026 launch

### Phase 3: Feature Expansion (Tier 3)
- Task assignment with notifications
- Budget tracking and variance reporting
- Daily crew reports
- Punch lists and sign-off workflow
- Gantt charts for project visualization
- Timeline: Post-mobile launch (Q3 2026)

## Current Status

### Working ✅
- Web platform: User auth, time entry, expense tracking, photo upload, project/task management
- Mobile foundation: PIN login, dashboard navigation, time entry API integration
- Database: SQLite with proper schema
- Deployment: Render continuous deployment working

### Not Working / Known Gaps ⚠️
- Mobile: Persistent auth storage (tokens lost on app restart)
- Mobile: Photo upload not yet implemented
- Web UI: Duplicate fields in Log Time workflow (bug 2026-03-23)
- Backend: API password hashes exposed in superadmin responses (security issue)
- Mobile: No offline capability

### Next Priority Task
Complete Phase 2 mobile development: Photo upload screen, Projects/Tasks listing screens, persistent auth (AsyncStorage). Then Android build config.

## Architecture

### Web Stack
- Frontend: Vue.js (SPA)
- Backend: Python Flask
- Database: SQLite (persistent disk on Render)
- Deployment: Render (auto-redeploy on git push)
- Auth: JWT + Bcrypt

### Mobile Stack
- Framework: React Native (Expo)
- Language: TypeScript
- State: Component state (upgrade to Context in Phase 3)
- API: Axios with Bearer token auth
- Deployment: Google Play (Android)

### API Contracts
**Worker Login:**
```
POST /api/workers/login
Body: { company, name, pin }
Response: { success, token, worker: { id, name, company } }
```

**Time Entry:**
```
POST /api/time-entries
Headers: Authorization: Bearer <token>
Body: { date, hours, project, notes? }
Response: { id, date, hours, project, notes? }
```

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-28 | Android expansion via React Native | Fastest path: reuses web API, component patterns familiar, JavaScript ecosystem strong |
| 2026-03-28 | Expo (not bare React Native) | Managed build process, simplified Android setup, faster iteration |
| 2026-03-28 | TypeScript for mobile | Type safety critical for API integration, catches bugs early |
| 2026-03-23 | Web Platform Tier 1 & 2 COMPLETE | Feature-complete for initial market entry, ready for customer trials |

## Files
- Web frontend: `~/Desktop/Project Organizer/Ledgerman/ledgerman/app/`
- Web backend: `~/Desktop/Project Organizer/Ledgerman/server.py`
- Mobile project: `~/Desktop/Project Organizer/Ledgerman/LedgermanMobile/`
- Deployment: Render CLI `render-deploy <service>`
