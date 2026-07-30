# How the Kiosk Works: A Guide for Advisors

The UAC Advising Kiosk is a walk-in check-in and queue system. A student tells it who they are and who they're here to see, and their name lands in that advisor's queue in real time.  It does not replace CRM Advise or any calendar system: nothing here books a real appointment or talks to another university system. It just tracks who's waiting and who's already been seen, today, in this office.

The app has a handful of screens that matter to you: the kiosk itself (what students see), your queue (what you see when you're logged in), a couple of shared-visibility queue views for College Admins and Suite Admins, and, for admins, a management dashboard for advisors and colleges.

## What the student sees

A student walks up to the kiosk and fills out five fields, in this order: full name, USC email, college, appointment type (Scheduled Advising Appointment or Office Hours: Drop-In), and advisor. College comes before advisor because the advisor list is filtered to that college, and only to advisors currently marked active, so a student can't accidentally select an advisor who is inactive or not associated with that college.

If a student picks Office Hours: Drop-In, the advisor dropdown gets one extra choice at the top: **Next Available**. A student who takes it isn't checking in for a specific person. That check-in has no advisor attached until someone claims it, and it shows up on the queue of every active advisor in that college at once, plus the College Admin and Admin queue views. Whichever advisor clicks "Waiting" on it first claims it: it becomes theirs and disappears from everyone else's queue. Next Available only appears for drop-ins; a Scheduled Advising Appointment still requires picking a specific advisor by name.

Once they submit, they get a confirmation screen with a checkmark and a ten-second countdown, then the kiosk resets itself to the blank form for the next student. There's no email or text sent to the student confirming their check-in. The confirmation screen is the only receipt they get.

## What you see: your queue

Log in at `[/login](https://advising-kiosk.pages.dev/login)` and you land on your queue. It shows students who picked you by name, plus any Next Available drop-ins waiting in your college that nobody has claimed yet. You will not see students who checked in for a named colleague, even one in your same college.

Each card shows the student's name, email, college, appointment type, a "Here to see: You" or "Here to see: Next Available" line, and a running wait timer. A Next Available card also carries a purple "Next Available" badge. New check-ins appear within a couple of seconds without you refreshing anything, and if your tab is open when it happens, you'll hear a two-tone chime and see a toast notification. Browsers block audio that isn't triggered by a click, so the very first chime of your session may not play until you've clicked somewhere on the page. After that it works normally. Keep the tab open if you want the chime and toast; the queue itself still updates in the background even if you're on another tab.

There are two actions on a card:

- **Waiting** (gold button): click this when you call the student back. It flips their status to "In Progress." On a Next Available card, this also assigns that student to you specifically, which is what pulls it off your colleagues' queues.
- **Mark as Seen** (green button): click this when you're done. It removes them from your queue for good.

Cards sort automatically, waiting students first, then in-progress, oldest check-in at the top of each group. There's no manual reordering, and there's no way to skip someone without marking them seen. If a student's wait time passes 15 minutes, their timer turns red so it's easy to spot who's been sitting the longest.

Marking someone "Seen" doesn't delete their record. It just takes them off the active queue. The check-in stays in the database for reporting.

## Your account

Your login is your email and a password, both set up by an admin. When an admin adds you (individually or through the bulk CSV upload), your account is created with the default password `uackiosk`. Change it the first time you log in, from **Change Password** in the top nav. There's no self-service "forgot password" link on the login screen right now: if you get locked out, ask your kiosk admin to reset your account in Supabase directly.

Where you land after signing in depends on your role and flags, checked in this order: full admins go to the admin dashboard, College Admins go to the College Queue, Suite Admins go to the Suite Queue, and everyone else goes to their own queue. If you hold more than one of these at once, or you're a full admin, the top nav grows extra tabs (My Queue, College Queue, Suite Queue, Admin) so you can jump between the views you have access to. An advisor only ever sees their own queue and no extra tabs.

## College Queue and Suite Queue

Beyond a single advisor's own queue, there are two shared, read-only views:

**College Queue** (`/college-admin`) shows every waiting and in-progress student across every advisor in one college, including unclaimed Next Available entries. You get this view if an admin has flagged your account as a College Admin. It's scoped to whichever college your own account belongs to, and there's no way to switch and view a different college from this screen.

**Suite Queue** (`/suite-admin`) shows every waiting and in-progress student assigned to any advisor flagged as working in the UAC Suite, across all colleges at once. You get this view if you're flagged as a Suite Admin. A Next Available entry doesn't show up here until an advisor actually claims it, since the view is built around who the student is assigned to, not where they checked in.

Full admins can open both of these views regardless of their own flags, from the same nav tabs.

## If you're an admin

The admin dashboard has five tabs:

**Live Queue** shows every college's queue at once, read-only, useful for a front-desk or leadership view of the whole office rather than one advisor's line. Next Available entries show up here labeled "Next Available" until an advisor claims them.

**Add Advisor** creates one advisor account at a time: name, email, college, and role (Advisor or Admin).

**Bulk Upload** takes a CSV (`name,email,college_name,role`) and creates accounts in batch. It skips rows with a missing name or email, a duplicate email, or a college name that doesn't exactly match one already in the system, and tells you why each row was skipped.

**Manage Advisors** lists everyone with toggles for Active, College Admin, UAC Suite, and Suite Admin, plus an edit button for their name, email, college, and role. None of the three new flags can be set from Add Advisor or Bulk Upload: every new account starts with all three off, and you turn them on here after the account exists. What each one does:

- **Active**: whether they appear in the kiosk's advisor dropdown at all. Deactivating someone pulls them off the kiosk immediately without touching their past check-in history.
- **College Admin**: gives them the College Queue tab, scoped to their own college.
- **UAC Suite**: marks that their office is physically in the UAC Suite. This is just a location tag; it doesn't grant any queue access by itself, but it's what determines whether their students show up in the Suite Queue.
- **Suite Admin**: gives them the Suite Queue tab, covering every advisor marked UAC Suite across all colleges.

**Manage Colleges** toggles which colleges appear on the kiosk. Adding a brand-new college isn't available in the app yet: that still has to be done directly in Supabase.

## What the kiosk doesn't do

It's easy to assume this tool does more than it does. It doesn't send confirmation emails or texts to students, and it doesn't notify a student when you mark them seen. It doesn't check availability or prevent double-booking, since there's no real scheduling underneath it, just a first-come queue. It doesn't integrate with any other systems. It doesn't print anything: the confirmation screen is on-screen only, gone as soon as the kiosk resets. And there's no reporting screen: every check-in is saved permanently, but no-shows, average wait times, or visit counts by month aren't available anywhere in the app. Pulling that kind of data means going into Supabase directly.
