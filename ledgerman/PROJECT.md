# Ledgerman
**Construction Management Software — by PMs for PMs**

## Status: Active — Phase 2 Complete (Backend + Multi-Device Sync)

## Purpose & Goals
Multi-tenant SaaS construction management platform. Started as the Belfort invoicing tool.
Now a fully independent product with a live backend, real authentication, and multi-device sync.
Selling at $25/month per company.

---

## Stack

### Frontend
- Pure HTML/CSS/JS (no framework)
- In-memory cache hydrated from backend on login
- localStorage as offline fallback
- IndexedDB for photos
- Deployed: Netlify

### Backend
- Python 3 / Flask REST API (port 5001)
- SQLite database (WAL mode, composite PKs for multi-tenancy)
- JWT authentication (admin + worker roles, company-scoped)
- TOTP 2FA (RFC 6238 — Google Authenticator / Authy compatible)
- Multi-tenant isolation: all data scoped to company_id from JWT

### Super Admin (LittleShield)
- Private management console (Lucas only)
- API key auth (X-Superadmin-Key header)
- Automated diagnostics, health checks, subscription management

---

## Live URLs
- **App:** https://unrivaled-cassata-ee2ea9.netlify.app
- **Marketing Site:** https://fascinating-hamster-ca5294.netlify.app
- **Backend:** https://ledgerman-backend.onrender.com (Render free tier — live)
- **Netlify Account:** lucastheofilou@gmail.com

---

## File Locations
```
~/Desktop/Project Organizer/
├── ledgerman/app/              ← frontend (HTML/CSS/JS)
│   ├── js/data.js             ← API client + cache layer (Phase 2)
│   ├── js/app.js              ← login/routing
│   ├── js/invite.js           ← worker onboarding
│   ├── js/totp.js             ← 2FA
│   ├── js/admin/              ← all admin modules
│   └── js/worker/             ← worker portal modules
├── ledgerman-backend/          ← Flask API
│   ├── server.py              ← all routes incl. superadmin
│   ├── database.py            ← SQLite schema
│   ├── auth.py                ← JWT helpers
│   ├── ledgerman.db            ← live database
│   └── .superadmin_key        ← LittleShield private key
├── ledgerman-admin/            ← LittleShield super admin console
├── ledgerman-site/             ← marketing website
├── ledgerman-backups/          ← automated daily/monthly backups
├── START-ALL.sh               ← launch everything (Linux/Mac)
├── START-ALL.bat              ← launch everything (Windows)
├── LEDGERMAN-BACKUP.sh         ← manual backup trigger
└── LEDGERMAN-PORTABLE-2026-03-14.zip  ← full portable transfer zip
```

---

## Admin Modules
- **Dashboard** — KPIs, quick actions, recent activity
- **Projects** — job tracking, subtasks, project detail
- **Approvals** — review time submissions (Clock In/Out badge vs Manual Entry badge)
- **Invoices** — create, print PDF, track payment, HST
- **Expenses** — review worker-submitted costs
- **Vendors** — vendor contacts and spend tracking
- **Clients** — client address book
- **Workers** — user management, PIN auth, invite system, 2FA
- **Photos** — job site photo log
- **Reports** — financial and labour summaries
- **Settings** — company info, password, backup/restore, branding, wizard
- **Help** — full in-app documentation including invite instructions

## Worker Portal Modules
- **Home** — active projects, quick access
- **Time Entry** — Clock In / Clock Out (auto-rounded to 15 min) + Manual Entry
- **History** — past submissions with approval status
- **Help** — worker guide

---

## Auth & Security
- Admin login: password → API → JWT → sync
- Worker login: PIN → API → JWT (or 2FA challenge) → sync
- 2FA: TOTP RFC 6238, verified server-side
- Worker invite: one-time server-issued token, expires 7 days
- Super admin: separate API key, never a JWT

---

## API Endpoints (key ones)
| Endpoint | Purpose |
|---|---|
| POST /api/companies/register | New company → JWT + companyId |
| POST /api/auth/admin | Admin login |
| POST /api/auth/worker | Worker PIN login |
| POST /api/auth/worker/verify2fa | Complete 2FA |
| GET /api/sync | Load all company data (called on every login) |
| POST /api/workers | Create worker |
| POST /api/invites | Create worker invite (server token) |
| GET /api/invites/:token | Validate invite (public) |
| PUT /api/invites/:token/use | Complete onboarding → JWT |
| GET /api/superadmin/companies | All companies + stats (Lucas only) |
| GET /api/superadmin/diagnostics/:id | LittleShield auto-diagnostics |

---

## Backup System
- **Automated:** cron job runs daily at 2:00 AM
- **Retention:** 30 daily + 12 monthly, auto-pruned
- **Location:** `ledgerman-backups/daily/` and `ledgerman-backups/monthly/`
- **Log:** `ledgerman-backups/backup.log`
- **Portable zip:** `LEDGERMAN-PORTABLE-2026-03-14.zip` (195KB — includes live DB)
- **Manual trigger:** `bash LEDGERMAN-BACKUP.sh`

---

## Pricing
- **$25/month per company**
- Support: aegiszeus2@gmail.com

---

## Phase Tracker
- [x] Phase 1 — Full working app (all modules, localStorage)
- [x] Phase 1.5 — Worker invite system, 2FA, Clock In/Out, email collection
- [x] Phase 1.6 — Marketing website + Netlify deployment
- [x] Phase 2 — Real backend (Flask + SQLite), JWT auth, multi-device sync
- [x] Phase 2.1 — LittleShield super admin console + automated diagnostics
- [x] Phase 2.2 — Automated backups (daily cron), portable transfer zip, system guide
- [x] Phase 2.3 — Backend deployed to Render → https://ledgerman-backend.onrender.com → true multi-device live (2026-03-14)
- [ ] Phase 3 — AI features (auto-invoice drafting, cost forecasting)
- [ ] Phase 4 — Scale: PostgreSQL, S3 photos, bcrypt passwords, Stripe billing

---

## Immediate Next Steps
1. Deploy `ledgerman-backend/` to Render or PythonAnywhere
2. Update `API_BASE` in `data.js` to cloud URL
3. Redeploy frontend to Netlify → multi-device sync goes live for all customers
4. Onboard Belfort (Laurence + Damino) on the live backend
