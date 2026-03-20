# Ledgerman — MASTER.md

**Last Updated:** 2026-03-20 18:00 (Mobile signup fix deployed, known issues documented)
**Status:** Phase 2.3.1 LIVE — Mobile signup buttons now stay visible on all devices
**Next Milestone:** Test signup with Laurence & Damiano on phones → monitor for issues

---

## Project Overview

**Ledgerman** is a multi-tenant SaaS construction management platform ($25/month per company).

**Live URLs & DNS Status:**
- **App backend:** https://ledgerman-backend.onrender.com ✅ (API, never direct access)
- **App frontend (Render):** https://ledgerman-frontend.onrender.com ✅ (not public-facing, behind DNS)
- **Marketing Static Site (Render):** https://ledgerman-marketing.onrender.com ✅ LIVE
- **Belfort website (Render):** https://belfort-website.onrender.com ✅ LIVE
- **Super Admin:** https://ledgerman-admin.onrender.com ✅ (Render Static Site)
- **🔴 BLOCKER:** https://ledgerman.org → currently points to Flask login page (app backend) instead of marketing site
  - **Issue:** GoDaddy DNS A record pointing to Render IP (216.24.57.7) but routing to wrong service
  - **Solution:** Update GoDaddy CNAME to ledgerman-marketing.onrender.com
  - **Status:** Pending Lucas confirmation of exact Static Site URL

**Tech Stack:**
- Frontend: HTML/CSS/JS + Render Static Site (auto-deploy from GitHub)
- Backend: Flask/SQLite + Render (free tier, wakes on request ~30s)
- Auth: JWT + TOTP 2FA (Google Authenticator)
- Backups: Automated daily cron (2AM) + master backup file

---

## Core Features (Phase 2.3)

✅ **Authentication:**
- Admin password login → JWT
- Worker PIN login → JWT
- Optional 2FA via Google Authenticator
- Email-based password/PIN reset
- Email 2FA delivery

✅ **Worker Management:**
- Admin generates one-time invite links
- Server-issued token → worker sets PIN + optional 2FA setup
- Multi-tenant isolation (admin sees only own company data)

✅ **Clock In/Out:**
- 15-min rounding on timestamps
- Real-time dashboard display
- Automated break tracking

✅ **Security (Phase 2.3):**
- Bcrypt hashing (passwords + PINs)
- Rate limiting (flask_limiter on login/API endpoints)
- Server-side audit logs (log_audit function, active queries logged)
- CSP headers (Content-Security-Policy, X-Frame-Options, X-Content-Type-Options)
- All 6 critical vulnerabilities patched
- `/api/superadmin/key` endpoint removed

✅ **Frontend Features:**
- Admin panel (mobile-optimized)
- Authwall (redirects unauthenticated users)
- Cookie consent + analytics
- Friction monitoring (auto-flag UX bottlenecks)
- Trade log + fee analysis
- Help system (5 tabs, embedded tooltips)

✅ **Super Admin Console:**
- Local: `~/Desktop/Project Organizer/ledgerman-admin/index.html`
- Live: https://ledgerman-admin.onrender.com
- Manual company creation (POST /api/superadmin/companies)
- Invite Company (Support tab) — generates branded sales pitch emails with Clearbit logo + Canvas brand colors
- Copy HTML/plain text or open in email client directly

✅ **Backups:**
- Auto-daily cron (2AM) → `ledgerman-backups/daily/` (30-day rotation) + `ledgerman-backups/monthly/` (12-month rotation)
- **Master backup:** `ledgerman/MASTERBACKUP.zip` — single canonical file, always overwritten by cron
- Transfer/restore: Copy this one file

✅ **GitHub + Render Deployment (2026-03-18):**
- **App frontend:** GitHub repo https://github.com/aegiszeus2/ledgerman → Render Web Service (port 8765)
  - Auto-deploys on git push; live at https://ledgerman-frontend.onrender.com
- **Marketing static site:** GitHub repo https://github.com/aegiszeus2/ledgerman-marketing → Render Static Site
  - Live at https://ledgerman-marketing.onrender.com; needs DNS CNAME from ledgerman.org
- **Belfort website:** GitHub repo https://github.com/aegiszeus2/belfort-website → Render Static Site
  - Live at https://belfort-website.onrender.com; needs DNS CNAME from belfortconstruction.ca
- **Backend:** GitHub repo https://github.com/aegiszeus2/ledgerman-backend → Render Web Service (port 5001)
  - Auto-deploys on git push; live at https://ledgerman-backend.onrender.com

---

## Deployment Checklist

- ✅ Frontend deployed to Render Static Site (auto-deploy from GitHub on push)
- ✅ Backend deployed to Render (free tier, auto-wake on first request ~30s)
- ✅ Super Admin deployed to Render Static Site (auto-deploy from GitHub on push)
- ✅ API_BASE updated to https://ledgerman-backend.onrender.com
- ✅ All endpoints verified (200 OK)
- ✅ SSL auto-provisioning (Render)
- ✅ All critical security patches deployed
- ⏳ **NEXT:** DNS fix for ledgerman.org → Render static site

---

## Roadmap

### Phase 2.3 (COMPLETE ✅)
- ✅ Real backend with multi-device sync
- ✅ In-memory cache layer
- ✅ API-first data.js
- ✅ Admin password reset via email
- ✅ Worker PIN reset via email
- ✅ 2FA (email-based)
- ✅ Mobile-optimized admin panel
- ✅ 8 bugs fixed
- ✅ All critical security patches (6/6 done)

### Phase 3 (PLANNED)
- **Auto-invoice drafting** (estimate → invoice pipeline)
- **Cost forecasting** (project ROI calculator)
- **Encrypted backups** ⚠️ (currently plain .zip — upgrade to AES-256 when available)
  - Low priority for MVP since MASTERBACKUP.zip is local (not server-exposed)
  - Revisit post-launch if handling sensitive customer data

### Phase 4 (ROADMAP)
- SQLite → PostgreSQL (scalability)
- S3 for photo storage (bandwidth + durability)
- Bcrypt password hashing (already done ✅)
- Stripe billing integration (SaaS subscriptions)
- Self-hosting (migrate from Render to self-managed VPS — post-MVP)

---

## Known Issues & Tech Debt (UPDATED 2026-03-20)

| Issue | Status | Priority | Notes |
|-------|--------|----------|-------|
| **Super Admin API key exposed** | 🔴 URGENT | CRITICAL | Key visible in conversation 2026-03-20. Immediate rotation required. |
| Signup "Load Failed" error | 🟡 INVESTIGATING | HIGH | Error occurs after submit on signup form. Frontend error handling suspected. Blocking Laurence/Damiano testing. |
| Mobile signup buttons hidden (FIXED 2026-03-20 17:30) | ✅ DONE | N/A | Create Company button scrolled off-screen on mobile. Fixed with fixed footer layout. Deployed & verified live. |
| Encrypted backups | TODO | Low | Phase 3; local backup not exposed |
| Server-side rate limiting | ✅ DONE | N/A | flask_limiter active |
| Bcrypt hashing | ✅ DONE | N/A | Passwords + PINs hashed |
| CSP headers | ✅ DONE | N/A | Content-Security-Policy deployed |
| Audit logs | ✅ DONE | N/A | Server-side logging active |

---

## Deployment Instructions

### Frontend Deployment (Render auto-deploy)
```bash
cd ~/Desktop/Project\ Organizer/Ledgerman/ledgerman
git push origin main  # Triggers Render auto-deploy → ledgerman-frontend.onrender.com
```

### Backend Deployment (Render)
```bash
# Backend already live on Render (render.yaml auto-deploy from GitHub)
# To redeploy after changes:
# 1. Push to GitHub: https://github.com/aegiszeus2/ledgerman-backend
# 2. Render auto-deploys (~2-3 min)
# 3. Verify: curl https://ledgerman-backend.onrender.com/api/health
```

### Local Testing
```bash
# Backend (Flask dev server, port 5001)
cd ~/Desktop/Project\ Organizer/ledgerman-backend
source venv/bin/activate
python server.py

# Frontend (simple HTTP server, port 8765)
cd ~/Desktop/Project\ Organizer/ledgerman/app
python -m http.server 8765

# Both: ./START-ALL.sh from Project Organizer root
cd ~/Desktop/Project\ Organizer
./START-ALL.sh
```

---

## Critical Files & Locations

```
~/Desktop/Project Organizer/Ledgerman/
├── ledgerman/                    # Frontend (HTML/CSS/JS)
│   ├── app/
│   │   ├── index.html          # Main app
│   │   ├── config.js           # API_BASE (change here if URL changes)
│   │   ├── js/                 # App logic
│   │   └── css/                # Styles
├── ledgerman-backend/            # Backend (Flask)
│   ├── server.py               # Main Flask app
│   ├── requirements.txt         # Dependencies
│   └── render.yaml             # Render auto-deploy config
├── ledgerman-admin/              # Super Admin console
│   └── index.html              # Local: file:///..., Live: ledgerman-admin.onrender.com
├── ledgerman-backups/            # Automated backup storage
│   ├── daily/                  # 30-day rotation
│   ├── monthly/                # 12-month rotation
│   └── MASTERBACKUP.zip        # Master copy (always current)
└── MASTER.md                   # This file
```

---

## Integration with Other Projects

**Belfort Construction:**
- First customers: Laurence (testing) + Damiano (live onboarding)
- Platform: https://ledgerman.org
- Super Admin console: https://ledgerman-admin.onrender.com
- Blockers: DNS fix needed for ledgerman.org → Render marketing site

**LittleShield:**
- Ledgerman is a LittleShield project (family protection + money-making)
- System status checked daily in LittleShield health check

---

## Security Checklist (Phase 2.3)

| Item | Status | Details |
|------|--------|---------|
| Bcrypt hashing | ✅ | Passwords + PINs hashed, salted |
| Rate limiting | ✅ | flask_limiter on login, API endpoints |
| Audit logs | ✅ | Server-side log_audit function active |
| CSP headers | ✅ | Content-Security-Policy, X-Frame-Options, X-Content-Type-Options |
| Encrypted backups | ❌ | Phase 3 (low priority, local backup) |
| SQL injection | ✅ | Parameterized queries (Flask ORM) |
| CSRF tokens | ✅ | Session-based JWT |
| `.superadmin_key` | ✅ | Removed from git, excluded in .gitignore |

---

## DNS Configuration Status (2026-03-18)

**Current Issue:** ledgerman.org serves Flask login page (app backend) instead of marketing site

**What's deployed:**
- ✅ ledgerman-marketing.onrender.com — Render Static Site, marketing HTML live
- ✅ belfort-website.onrender.com — Render Static Site, Belfort HTML live
- ✅ ledgerman-backend.onrender.com — Flask API, working
- ✅ ledgerman-frontend.onrender.com — Render Web Service, app login working

**What's wrong:**
- GoDaddy has A record pointing ledgerman.org to Render IP (216.24.57.7), but Render IP routes to wrong service
- **Should be:** ledgerman.org CNAME → ledgerman-marketing.onrender.com
- **Should be:** belfortconstruction.ca CNAME → belfort-website.onrender.com

**Action needed:**
1. Get exact Render Static Site URLs (confirm marketing site is `ledgerman-marketing.onrender.com`)
2. Update GoDaddy CNAMEs (manual UI if API still not working)
3. Wait ~5-15 min for DNS propagation
4. Test: https://ledgerman.org should show marketing site, not login page

---

## Monitoring & Health Checks

**Backend health:**
```bash
curl https://ledgerman-backend.onrender.com/api/health
# Expected: 200 OK
```

**Frontend status:**
```bash
# Open: https://ledgerman.org (should show login screen)
```

**Logs:**
- Backend: Render logs (https://dashboard.render.com) → ledgerman-backend service
- Frontend: Render logs (https://dashboard.render.com) → ledgerman-frontend service
- Admin: Render logs (https://dashboard.render.com) → ledgerman-admin service

---

## Next Steps

### IMMEDIATE (BLOCKER)
1. 🔴 **Fix DNS:** GoDaddy CNAME update needed
   - Confirm exact Render Static Site URL for marketing site (ledgerman-marketing.onrender.com)
   - Update GoDaddy: ledgerman.org CNAME → ledgerman-marketing.onrender.com
   - Verify: https://ledgerman.org should show marketing site (not Flask login)
   - Same for https://belfortconstruction.ca → belfort-website.onrender.com

### NEXT (Belfort onboarding) — BLOCKED until DNS fixed
1. Test app with Laurence (feedback → fixes)
2. Onboard Damiano as first live customer
3. Monitor analytics (email opens, sign-ups)
4. Gather feedback for Phase 3 features

### POST-LAUNCH (Phase 3+)
1. Auto-invoice drafting
2. Cost forecasting
3. Encrypted backups
4. PostgreSQL migration
5. Self-hosting infrastructure

---

## Version History

| Date | Version | Status | Notes |
|------|---------|--------|-------|
| 2026-03-14 | Phase 2.3 | COMPLETE | All critical features deployed, 6 critical vulnerabilities patched |
| 2026-03-15 | Phase 2.3 | LIVE | Backend live on Render, frontend auto-deploys, API 200 OK |
| 2026-03-16 | Phase 2.3 | READY | Encrypted backups noted for Phase 3; ready for Belfort onboarding |
| 2026-03-18 | Phase 2.4 | BLOCKER | All Render Static Sites deployed (marketing + Belfort), GitHub repos live, DNS misconfiguration identified |
| 2026-03-20 | Phase 2.4+ | IN PROGRESS | Mobile signup buttons fixed (fixed footer), API verified HTTP 201, Super Admin key exposed (urgent rotation), "Load Failed" error under investigation |
