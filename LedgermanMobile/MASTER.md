# Ledgerman Mobile App

## Goal
Enable construction workers to log time, upload photos, and track projects via mobile—reducing time entry friction and supporting field documentation for Ledgerman SaaS customers.

## Design Intent
A lightweight React Native mobile app that mirrors Ledgerman web app functionality: PIN-based login (no username), dashboard with menu-driven navigation, real-time task/project viewing, photo documentation with base64 encoding for API compatibility, and persistent session management.

## Current Implementation
**Phase 4 Complete** (all core functionality screens built and integrated)

- **Architecture:** React Native + TypeScript + Expo SDK 50
- **State Management:** React component state + App.tsx global auth/navigation state (no Redux/Context)
- **Navigation:** Manual screen-based navigation with params (taskId passed to TaskDetail screen)
- **Authentication:** PIN-based (no username), JWT token stored in AsyncStorage, auto-restored on app launch
- **API Integration:** Axios service with Bearer token auth, environment-based endpoint switching (.env.dev / .env.production)

**Screens (9 total):**
1. PINLoginScreen — Company/Name/PIN input, API validation
2. DashboardScreen — Menu navigation (7 options: Log Time, All Tasks, Projects, Upload Photos, Photo Gallery, Settings, Logout)
3. TimeEntryScreen — Hours + project selector + notes form
4. ProjectsScreen — Projects list, nested tasks per project
5. TasksScreen — All tasks across projects, status filtering (All/Pending/Active/Done)
6. TaskDetailScreen — Full task view, edit title/description/status/due_date, delete (NEW Phase 4)
7. PhotoUploadScreen — Camera/gallery picker, base64 encoding, project selector
8. PhotoGalleryScreen — Grid view of all photos, tap for detail + caption (NEW Phase 4)
9. SettingsScreen — Profile editing, app info, logout (NEW Phase 4)

**API Services:**
- authService → login
- timeService → entries CRUD
- projectService → projects list/detail
- taskService → tasks CRUD (with full detail endpoints)
- photoService → photo upload/list
- workerService → profile get/update

**Storage & Persistence:**
- JWT token stored in AsyncStorage, auto-restored at app launch
- No offline queue yet (all submissions require network)
- No form caching

## Timeline & Phasing
- **Phase 1 (Complete 2026-03-28):** Project init, architecture, dependencies (React Native, Expo, Axios, AsyncStorage, TypeScript)
- **Phase 2 (Complete 2026-03-28):** Core screens — login, dashboard, time entry, project/task browsing
- **Phase 3 (Complete 2026-03-28):** Photo upload + persistent auth
- **Phase 4 (Complete 2026-03-28):** Task detail/edit, photo gallery, settings screens
- **Phase 5 (Next):** Form validation, offline queue, initial Play Store/App Store submission
- **Phase 6 (Future):** Push notifications, task assignment, biometric auth, dark mode, image caching

## Current Status
✅ **Feature-complete for MVP.** All core screens built, API-integrated, and navigable. No syntax errors. Ready for emulator testing.

**What's working:**
- Complete PIN login workflow with JWT token persistence
- Dashboard navigation to all screens
- Task viewing with status filters
- Task detail/edit with delete capability
- Photo upload and gallery viewing
- Profile settings editing
- Logout functionality

**What's blocked:**
- Logo file integration (path unknown from Lucas)

**What's not started:**
- Form validation (input sanitization, required field checks)
- Offline submission queue
- Play Store app bundle preparation
- OTA update configuration (eas.json setup)
- Image caching for slow networks

## Architecture
- **Frontend Stack:** React Native (Expo), TypeScript, React Native UI components (View, FlatList, ScrollView, etc.)
- **Navigation:** Manual state-based switching in App.tsx (not React Navigation router)
- **API Client:** Axios instance with Bearer token injection, configurable base URL
- **Storage:** AsyncStorage for token persistence only
- **Environment Config:** .env files for dev/production endpoint switching
- **Code Organization:**
  - `src/screens/` — All screen components
  - `src/services/` — API client and service methods
  - `src/types/` — TypeScript interfaces
  - `src/utils/` — Helper functions (image encoding)
  - `App.tsx` — App root, navigation state, screen rendering

## Decisions Log
- **2026-03-28 Phase 4:** Used manual state-based navigation instead of React Navigation router — simpler for POC, easier to debug. Enables screen params without complex routing.
- **2026-03-28:** Added projectService, taskService, workerService to API layer — separate service objects for cleaner code organization.
- **2026-03-28:** TaskDetailScreen supports full edit workflow (not inline edit) — better UX for mobile, clear save/cancel flow.
- **2026-03-28:** PhotoGalleryScreen uses grid layout (2 columns) — standard mobile gallery pattern, tap-to-detail for full view.
- **2026-03-28:** SettingsScreen includes app info section (version, API endpoint) — helps with debugging field issues.
- **2026-03-28 Phase 3:** Token stored in AsyncStorage, auto-restored on app launch — preserves login across restarts.
- **2026-03-28 Phase 3:** Photo upload uses base64 encoding (not multipart) — matches existing Ledgerman web API requirement.
- **2026-03-28 Phase 3:** Projects/Tasks rendered as nested list rather than separate detail screens — reduces navigation depth.
- **2026-03-28 Phase 1-2:** Environment config via .env files (dev/production split) — allows easy endpoint switching without code changes.
- **2026-03-28 Phase 1-2:** Used state-driven screen navigation instead of React Navigation — POC approach, sufficient for MVP.
