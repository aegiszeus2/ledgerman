# Tasks — Ledgerman Mobile

## Priority 1 (Do Now)
- [ ] Test Phase 4 screens on Android emulator — Verify Task detail/edit, Photo gallery, Settings screens work correctly
- [ ] Test Phase 4 screens on iOS simulator — Verify on iOS
- [ ] Provide logo file path — Lucas to clarify file location for app branding
- [ ] Integrate logo into Dashboard/header — Add once file path is known

## Priority 2 (Do Soon)
- [ ] Set up EAS (Expo Application Services) for OTA updates — Configure eas.json and link project
- [ ] Configure Play Store submission — Prepare signing keys, app bundle, metadata
- [ ] Add input validation to all forms — Title, description, due date field validation
- [ ] Add offline sync queue — Store submissions locally if network unavailable

## Priority 3 (Backlog)
- [ ] Implement image caching in Photo Gallery — Improve performance on slow networks
- [ ] Add biometric authentication option — Fingerprint/Face ID as alternative to PIN
- [ ] Implement task assignment delegation — Allow workers to assign tasks to others
- [ ] Add push notifications — Notify workers of new tasks or photo feedback
- [ ] Dark mode support — Add theme switching capability

## Completed (Phase 4)
- [x] Build Task detail/edit screen — Full CRUD for tasks (view, edit, delete) — 2026-03-28
- [x] Build Photo gallery screen — Grid view + detail view of uploaded photos — 2026-03-28
- [x] Build Settings screen — Profile editing, app info, logout — 2026-03-28
- [x] Add projectService and taskService to API layer — Endpoints for project/task CRUD — 2026-03-28
- [x] Update App.tsx navigation — Add TaskDetail, PhotoGallery, Settings screens with routing — 2026-03-28
- [x] Update DashboardScreen menu — Add Photo Gallery and Settings buttons — 2026-03-28
- [x] Complete Phase 3 — Photo upload + Projects/Tasks screens + persistent auth — 2026-03-28 (prior)

## Testing Checklist
- [ ] Login workflow (Company/Name/PIN)
- [ ] Dashboard navigation (all 7 menu items)
- [ ] Time entry submission
- [ ] Projects list and nested task view
- [ ] Tasks list with all status filters (All/Pending/Active/Done)
- [ ] Task detail: open, edit, save, delete
- [ ] Photo upload: camera, gallery, preview
- [ ] Photo gallery: grid view, tap detail, captions visible
- [ ] Settings: edit profile, view app info, logout
- [ ] Token persistence: logout → restart app → login required
- [ ] Refresh controls on all list screens
- [ ] Error handling (invalid API response, network error)
