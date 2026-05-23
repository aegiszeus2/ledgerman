# OPERATION_STATE.md — Worker Portal: Email Prompt + Floating Button Overlap
**Created:** 2026-05-23
**Phase:** STAGE 2 IN PROGRESS — Implementation
**APPROVAL STATUS:** APPROVED 2026-05-23 — Explicit human approval received

---

## CURRENT SAFE NEXT ACTION:
**IMPLEMENT** — human approval received. Executing:
1. Add PATCH /api/workers/me/email to ledgerman-backend/server.py
2. Move "? How To" button to bottom:128px in js/app.js
3. Bump app.js version string in index.html
4. Commit + push both repos
5. Verify Render deploy

## DO NOT DO:
- Modify any file other than the three listed above
- Run migrations
- Change auth/settings/tenant config

## LAST VERIFIED STATE:
Full read-only forensic discovery complete 2026-05-23. All findings are evidence-based observations from local source code and repository history. No files have been modified.

---

## OBJECTIVE

Fix two recurring Worker Portal usability issues:

**Issue 1:** Worker Portal repeatedly asks for the worker's email after login, even when the email should already be stored on the server record.

**Issue 2:** On mobile views, the Worker Portal has two floating buttons (AI "Help" FAB and "? How To" button) positioned at nearly identical coordinates, causing them to visually overlap and making one or both inaccessible.

---

## CANONICAL SOURCES (Confirmed)

| Source | Identity |
|--------|----------|
| Repo (local) | `/home/lucaspc3/Desktop/Project Organizer/Ledgerman/` |
| Active branch | `main` (up to date with origin/main) |
| Latest commit | `0be3301` — Feat: Spec Search edit/delete/history |
| Backend submodule | `ledgerman-backend/server.py` |
| Frontend SPA | `index.html` + `js/app.js` + `js/ai-assistant.js` |
| Worker portal JS | `js/worker/` directory |
| Worker CSS | `css/worker.css` |
| Production backend | `ledgeman-backend.onrender.com` |
| Production frontend | Render static hosting |
| Database | `/data/ledgerman.db` (SQLite, Render persistent disk) |

---

## FORENSIC FINDINGS

### Issue 1 — Email Prompt Repeating: ROOT CAUSE CONFIRMED

**The PATCH /api/workers/me/email backend endpoint does not exist.**

Evidence chain:
1. `js/data.js:276` — `workerUpdateMyEmail()` calls `PATCH /api/workers/me/email`
2. `js/app.js:982` — Email prompt form calls `AppData.workerUpdateMyEmail(email)` on submit
3. `ledgerman-backend/server.py` — All `/api/workers/*` routes confirmed:
   - `GET /api/workers` (line 1141) — admin only
   - `POST /api/workers` (line 1155) — admin only
   - `PUT /api/workers/<id>` (line 1203) — admin only, @require_admin
   - `DELETE /api/workers/<id>` (line 1247) — admin only
   - NO `PATCH /api/workers/me/email` exists anywhere
4. Result: Every call from the email prompt form gets a 404. Email is never saved to the database.

**Failure sequence:**
1. Worker logs in → `_completeWorkerLogin()` → `worker.email` is empty from server → shows `_showEmailPrompt()`
2. Worker submits email → `workerUpdateMyEmail(email)` → 404 from server
3. Catch block logs warning, sets `AppData.setData('worker_email_prompted_<id>', true)` → localStorage
4. Worker proceeds to portal
5. **Same browser, next login:** `alreadyPrompted = true` from localStorage → no prompt (appears fixed)
6. **New browser / different device / incognito / cleared cache:** localStorage gone; `worker.email` still empty from server → prompt shows again

**Prior fix (commit 4b5c8ac, 2026-05-21):** Added frontend half correctly — `workerUpdateMyEmail()` in data.js and the call in app.js. Backend endpoint was never implemented. The fix is half-complete.

---

### Issue 2 — Floating Button Overlap: ROOT CAUSE CONFIRMED

**Two floating buttons injected at nearly identical screen coordinates in the Worker Portal.**

**Button A: Worker AI Assistant FAB** (`#waiAssistantFab`)
- File: `js/ai-assistant.js:961-968`
- CSS: `position:fixed; bottom:80px; right:24px; z-index:9000`
- Label: chat icon + "Help"
- Visible range: approximately 80–113px from screen bottom

**Button B: "? How To" Button** (`#pageHelpBtn`)
- File: `js/app.js:1680-1693`
- CSS: `position:fixed; bottom:70px; right:16px; z-index:888`
- Label: "? How To"
- Visible range: approximately 70–102px from screen bottom

**Overlap:** Both buttons occupy 70–113px from bottom on the right side. They are 10px apart vertically and 8px apart horizontally — directly overlapping.

**Bottom nav bar:** `position:fixed; bottom:0; height:72px` — occupies 0–72px. Both buttons sit just above it.

**Admin portal:** Admin "? How To" at `bottom:24px` does not overlap admin AI FAB at `bottom:80px`. Only the Worker Portal is affected.

---

## CONFIRMED FACTS

1. `PATCH /api/workers/me/email` endpoint does NOT exist in `ledgerman-backend/server.py`
2. `workerUpdateMyEmail()` in `data.js` is correctly implemented client-side but calls a non-existent backend route
3. Email prompt localStorage flag `ledgeman_worker_email_prompted_<id>` is not cross-device persistent
4. Worker email is never written to the database through the email prompt form
5. Worker AI FAB: `bottom:80px; right:24px` (ai-assistant.js line 962)
6. "? How To" button: `bottom:70px; right:16px` (app.js line 1681)
7. Both buttons overlap — 10px vertical gap, 8px horizontal gap, less than button height
8. `@require_worker` decorator accepts both role='worker' and role='admin' tokens
9. Worker JWT payload contains: `companyId`, `role`, `workerId`, `name`, `workerRole`
10. `_safe_worker()` strips pin/totp_secret/admin_password; email field is returned
11. Backend submodule auto-deploys on push to its GitHub repo
12. JS files have immutable cache headers; version strings control cache-busting
13. Current app.js version: `v=20260521-auth1`
14. Prior fix attempt (4b5c8ac, 2026-05-21) added frontend half of Issue 1 — backend half never built

---

## UNVERIFIED CLAIMS

- Whether any workers currently have emails saved in the production database
- Whether the Render backend is currently on the latest local commit
- Whether the `worker_ai` module flag is enabled for all companies in production (default: true)

---

## RISK ASSESSMENT

**Issue 1 Fix — Add backend endpoint:** LOW RISK
- New endpoint only; does not modify any existing route
- Scoped strictly to authenticated worker's own record (workerId + companyId from JWT)
- Only updates email field — no financial, auth, or security data
- Email format validation included
- No schema migration needed — email column already exists
- Rollback: revert commit → endpoint returns 404 again (pre-fix behavior)

**Issue 2 Fix — Move button position:** LOW RISK
- One CSS property change (`bottom:70px` → `bottom:128px`)
- No functional behavior change
- No effect on button click handler, routing, or content
- Easily reversible with one-line revert
- Admin portal "? How To" button (line 1507, `bottom:24px`) is not affected

---

## INTENDED MODIFICATIONS

### File 1: `ledgerman-backend/server.py`
Insert after line 1261 (after delete_worker function, before GENERIC ENTITIES section):

```python
@app.route('/api/workers/me/email', methods=['PATCH'])
@require_worker
def worker_self_update_email():
    """
    Allow a logged-in worker to save or update their own email address.
    Auth: Bearer worker JWT (role == 'worker' or 'admin')
    Body: { email: str }
    Returns: updated worker record (sensitive fields stripped).
    """
    worker_id  = g.auth.get('workerId')
    company_id = g.auth.get('companyId')

    if not worker_id:
        return jsonify({'error': 'Worker identity not found in token'}), 400

    body  = request.get_json(silent=True) or {}
    email = (body.get('email') or '').strip()

    import re as _re
    if email and (len(email) > 254 or not _re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email)):
        return jsonify({'error': 'Invalid email address'}), 400

    db = get_db()
    try:
        existing = row_to_dict(
            db.execute(
                "SELECT * FROM workers WHERE id = ? AND company_id = ?",
                (worker_id, company_id)
            ).fetchone()
        )
        if not existing:
            return jsonify({'error': 'Worker not found'}), 404

        db.execute(
            "UPDATE workers SET email = ? WHERE id = ? AND company_id = ?",
            (email, worker_id, company_id)
        )
        db.commit()

        updated = row_to_dict(
            db.execute("SELECT * FROM workers WHERE id = ?", (worker_id,)).fetchone()
        )
    finally:
        db.close()

    return jsonify(_safe_worker(updated, is_privileged=False)), 200
```

### File 2: `js/app.js`
Line 1681: Change worker "? How To" button bottom position
- From: `'bottom:70px'`
- To: `'bottom:128px'`

Visual result:
- 0–72px: worker bottom nav bar
- 80–113px: AI Help FAB (existing, unchanged)
- 128–160px: "? How To" button (moved up, 15px clear gap above AI FAB)

### File 3: `index.html`
Line with `js/app.js?v=20260521-auth1`:
- From: `js/app.js?v=20260521-auth1`
- To: `js/app.js?v=20260523-fix1`

---

## DEPLOYMENT PLAN

1. Edit `ledgerman-backend/server.py` (new endpoint)
2. Commit + push `ledgerman-backend` submodule → triggers Render backend auto-deploy
3. Edit `js/app.js` (button position fix)
4. Edit `index.html` (version string bump)
5. Commit + push main repo → triggers Render frontend static deploy
6. Verify: check Render deploy logs, test live URL

---

## ROLLBACK PLAN

- Backend: `git revert <commit>` in ledgerman-backend submodule → push → Render auto-deploys previous version. Endpoint returns 404 (pre-fix behavior).
- Frontend: `git revert <commit>` in main repo → push → Render redeploys. Button returns to bottom:70px.
- Both rollbacks are clean, fast, and non-destructive.

---

## STOP CONDITIONS ENCOUNTERED

None. All evidence obtained cleanly.
