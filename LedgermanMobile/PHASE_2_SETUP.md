# Phase 2 Setup Complete

## What's Built
1. **PIN Login Screen** (`src/screens/PINLoginScreen.tsx`)
   - Inputs: Company, Worker Name, PIN
   - API call to `/api/workers/login` with credentials
   - Success → navigates to Dashboard
   - Error handling with Alert notifications

2. **Dashboard Screen** (`src/screens/DashboardScreen.tsx`)
   - Displays worker name and company
   - Menu items: Log Time, Projects, Expenses
   - Logout button

3. **Time Entry Screen** (`src/screens/TimeEntryScreen.tsx`)
   - Inputs: Hours, Project, Notes (optional)
   - API POST to `/api/time-entries`
   - Date auto-filled (today)

4. **API Service** (`src/services/api.ts`)
   - Axios instance with base URL config
   - Auth token management (Bearer token)
   - Methods: `authService.login()`, `timeService.createEntry()`, etc.
   - Configurable endpoints via .env

## Environment Setup
- `.env` — Development endpoint: `http://app.ledgerman.org/api`
- `.env.production` — Production endpoint (same for now)

## Running the App
```bash
cd ~/Desktop/Project\ Organizer/Ledgerman/LedgermanMobile
npm start
```

Then choose:
- `a` — Launch Android emulator
- `i` — Launch iOS simulator
- `w` — Launch web version

## API Integration
The app expects the backend to provide:
```
POST /api/workers/login
Body: { company, name, pin }
Response: { success: true, token: "...", worker: { id, name, company } }

POST /api/time-entries
Headers: Authorization: Bearer <token>
Body: { date, hours, project, notes? }
Response: { id, date, hours, project, notes? }
```

## Next (Phase 3)
- Photo upload with camera
- Projects/Tasks screens
- Persistent auth (AsyncStorage)
- Expenses tracking
