# Changelog

All notable changes to the UAC Advising Kiosk are documented here.

---

## [Unreleased]

### Features
- **Nightly queue reset** — a scheduled Power Automate flow saves the day's queue to SharePoint as a dated CSV, then calls the new `clear-queue` edge function to empty the `queue` table (see `docs/power-automate-guide.md`)

### Docs
- Added the advisor user guide and Power Automate guide; updated "How the Kiosk Works"

---

## [1.8.0] — 2026-11-03

### Features
- **Manage Advisors filters** — search plus status, college, role, college admin, and assigned major filters
- **Require notes split by appointment type** — colleges now have separate "require student notes" settings for Scheduled and Drop-In appointments

### Database
- Migration `20261103000000_split_require_notes.sql`

---

## [1.7.0] — 2026-10-28 – 2026-10-30

### Features
- **Per-college kiosk settings** — toggles to allow "Next Available" for drop-ins and to require student notes
- **Student Assistant role** — read-only College Queue access; hidden from student advisor selection
- **"Do not display on student selection"** toggle on Edit Advisor
- **Queue editing for college admins** — change a student's status and record which advisor saw them
- **College Queue export** to a multi-sheet .xlsx
- **Reset password** button in Edit Advisor — resets an advisor to the default password (new `reset-advisor-password` edge function; platform admins any school, system admins their own school only, never a platform admin)
- **View as advisor** — admins can open a read-only view of an advisor's queue from Edit Advisor

### Fixed
- Queue-to-advisor joins pinned to `advisor_id` now that `queue` has two advisor foreign keys

### Database
- Migration `20261030000000_college_kiosk_settings_student_assistant.sql`

---

## [1.6.0] — 2026-09-24 – 2026-09-30

### Features
- **Advisor start date** on Add Advisor, Edit Advisor, and bulk upload

### Performance
- **Realtime queue** — new `useLiveQueue` hook loads the queue once and applies Realtime INSERT/UPDATE/DELETE events, replacing 2–10 second polling on the advisor, admin, college admin, and suite pages; refetches on reconnect, focus, and tab visibility, with a 3-minute backstop that pauses while the tab is hidden
- Queue queries select explicit columns instead of `select *`

### Database
- Added `start_date` to `advisors`
- Migration `20260930000000_realtime_queue_publication.sql` ensures `queue` is in the `supabase_realtime` publication

---

## [1.5.0] — 2026-09-11

### Features
- **Multi-tenant theming** — new `schools` table; colors and logo load at runtime and apply as CSS variables across the app
- **Theme Settings** page (`/theme-settings`) for campus admins: theme name, logo upload, and color pickers
- **School logo** shown in the NavBar (enlarged to 44px)
- **Platform Admin / System Admin roles** — the old `admin` role is split; system admins are limited to their own school, platform admins work across schools
- **School switcher** in the NavBar for platform admins (own school, a specific school, or All Schools); Live Queue, Manage Advisors, Manage Colleges, Add Advisor, Bulk Upload, and Theme Settings follow the selection

### Security
- Admin panel queries scoped by `school_id`; `school_id` added to `colleges` and `queue`
- `create-advisor` rejects a system admin granting `platform_admin` or targeting another school
- Theme and logo-storage RLS limited to the user's own school (platform admins any school)

### Fixed
- Theme saves failing with 403 because `UPDATE` on `schools` was not granted to `authenticated`

### Database
- Migrations `20260911000000_multi_tenant_theming.sql`, `20260911010000_platform_system_admin_role_split.sql`
- New `download-queue-archive` edge function; `create-advisor` updated for new roles

### Known gaps
- `advisors`, `queue`, and `colleges` still have no RLS; Suite Admin and EA Suite Admin pages are not yet school-scoped

---

## [1.4.0] — 2026-09-10

### Features
- **Student Kiosk link** added to the NavBar — advisors can open the live student-facing check-in page directly from the advisor interface
- **Print Check-In Sign** button added to all queue pages (Admin, Advisor, College Admin, EA Suite Admin, Suite Admin) — opens a static PDF bundled with the app, replacing the previous dynamically generated QR sign page
- Static check-in sign PDF (`advising-checkin-sign.pdf`) added to the public folder for reliable, always-available access

## [1.3.0] — 2026-08-31

### Features
- **Seen Today section** added to all queue views (Admin, Advisor, College Admin, EA Suite Admin, Suite Admin) — shows every student marked seen since midnight, with wait time frozen at the moment they were called
- **Queue split into three sections** across all views: Live Queue (waiting), Currently Being Seen (in-progress), and Seen Today
- **Student notes** displayed in all queue tables — students can leave a note at check-in; advisors and admins see it inline
- **Office hours toggle** on advisor profiles — advisors can mark themselves available for office hours drop-ins
- **Appointment type badge** (ApptBadge) distinguishes Office Hours: Drop-In from other appointment types at a glance
- **Status badge** (waiting / in-progress / seen) shown on all queue rows
- **Frozen wait timer** — wait time stops counting when a student is marked in-progress and locks in at the actual elapsed time
- **Kiosk Guide link** added to the NavBar, linking advisors to the Scribehow guide

### Database
- Added `office_hours_available` (boolean) to `advisors` table
- Added `notes` (text) to `queue` table
- Added `in_progress_at` (timestamptz) to `queue` table — used to freeze wait timers accurately

### Styling
- Full USC color palette audit across every page and component — all non-official colors replaced
- Garnet NavBar with white banner text; USC Grass accent color throughout

---

## [1.2.0] — 2026-08-24 – 2026-08-25

### Features
- **EA Suite admin queue view** — new page and route for EA Suite admins
- **Advisor-major associations** — junction table (`advisor_majors`), admin checklist in Edit Advisor modal, and kiosk-side filtering so students only see advisors assigned to their major
- **Assigned Majors checklist** in Edit Advisor modal, scoped to the advisor's college
- **Require Major toggle** in Manage Colleges — colleges can require students to select a major at check-in
- **Louder 3-tone check-in chime** — ascending C5 → E5 → G5 burst replacing the old single tone
- **Browser push notifications** on new check-in — fires even when the advisor tab is in the background
- **Tab title flash** — browser tab alternates between "🔔 New Check-In!" and "Your Queue" until the advisor focuses the tab
- **Access & status toggles** on Add Advisor and Edit Advisor — Active, UAC Suite, Suite Admin, EA Suite, EA Suite Admin, all saveable in one form

### Improvements
- Manage Advisors table rebuilt: inline status badges, sortable columns, per-row toggle switches, EA Suite field in edit modal

### Fixed
- EditAdvisorModal opening to a blank page

---

## [1.1.0] — 2026-07-30

### Features
- **College Admin queue view** — role-gated page showing all students in a college's queue
- **Suite Admin queue view** — role-gated page showing the full UAC Suite queue
- **Next Available drop-in option** on the kiosk check-in form — students can check in without selecting a specific advisor; any advisor in the college can claim the student
- **Printable QR code check-in sign** — generates a QR code pointing to the kiosk URL, formatted for printing and posting in advising offices
- **Advisor-facing documentation** — "How the Kiosk Works" guide added to `docs/`
- **Role-based NavBar links** — My Queue, College Queue, Suite Queue, and Admin tabs shown based on the advisor's role flags

### Improvements
- Advisor queue now surfaces Next Available check-ins for the advisor's college alongside their own, with a claim button to assign the student
- Updated advisor documentation to cover Next Available, College Queue, and Suite Queue

### Fixed
- Intermittent stuck loading state when adding an advisor (deferred `fetchAdvisorProfile` inside `onAuthStateChange` to avoid Supabase-js deadlock)

---

## [1.0.0] — 2026-04-09

### Initial Release
- **Student kiosk check-in flow** — name, email, college, advisor (filtered by college), and appointment type (Scheduled Advising Appointment or Drop-In); 10-second auto-reset after successful check-in
- **Advisor queue view** — real-time queue with live polling, Supabase Realtime subscription, audio chime, and toast notifications on new check-ins
- **Admin panel** with four tabs: Live Queue, Add Advisor (single and bulk CSV upload), Manage Advisors, and Manage Colleges
- **Role-based access** — advisor, college-admin, suite-admin, and admin roles enforced via ProtectedRoute and AuthContext
- **`create-advisor` edge function** — creates Supabase auth users for new advisors with a default password
- Login page with Supabase email/password auth
