# How the Kiosk Works: A Guide for Advisors

The UAC Advising Kiosk is a walk-in check-in and queue system. A student sits down at the kiosk, tells it who they are and who they're here to see, and their name lands in that advisor's queue in real time. It replaces a paper sign-in sheet. It does not replace Starfish, Navigate, or any calendar system: nothing here books a real appointment or talks to another university system. It just tracks who's waiting and who's already been seen, today, in this office.

The app has three screens that matter to you: the kiosk itself (what students see), your queue (what you see when you're logged in), and, if you're an admin, a management dashboard for advisors and colleges.

## What the student sees

A student walks up to the kiosk and fills out five fields: full name, USC email, college, advisor, and appointment type (Scheduled Advising Appointment or Drop-In). The advisor list only shows names from the college they picked, and only advisors currently marked active, so a student can't accidentally book you if you're inactive or if you're not associated with that college.

Once they submit, they get a confirmation screen with a checkmark and a ten-second countdown, then the kiosk resets itself to the blank form for the next student. There's no email or text sent to the student confirming their check-in. The confirmation screen is the only receipt they get.

## What you see: your queue

Log in at `/login` and you land on your queue, filtered to just the students who picked you by name. You will not see students who checked in for a colleague, even one in your same college.

Each student shows up as a card with their name, email, college, appointment type, and a running wait timer. New check-ins appear within a couple of seconds without you refreshing anything, and if your tab is open when it happens, you'll hear a two-tone chime and see a toast notification. Browsers block audio that isn't triggered by a click, so the very first chime of your session may not play until you've clicked somewhere on the page. After that it works normally. Keep the tab open if you want the chime and toast; the queue itself still updates in the background even if you're on another tab.

There are two actions on a card:

- **Waiting** (gold button): click this when you call the student back. It flips their status to "In Progress."
- **Mark as Seen** (green button): click this when you're done. It removes them from your queue for good.

Cards sort automatically, waiting students first, then in-progress, oldest check-in at the top of each group. There's no manual reordering, and there's no way to skip someone without marking them seen. If a student's wait time passes 15 minutes, their timer turns red so it's easy to spot who's been sitting the longest.

Marking someone "Seen" doesn't delete their record. It just takes them off the active queue. The check-in stays in the database for reporting.

## Your account

Your login is your email and a password, both set up by an admin. When an admin adds you (individually or through the bulk CSV upload), your account is created with the default password `uackiosk`. Change it the first time you log in, from **Change Password** in the top nav. There's no self-service "forgot password" link on the login screen right now: if you get locked out, ask your kiosk admin to reset your account in Supabase directly.

Your role, advisor or admin, determines where you land after signing in. Advisors go to their queue. Admins go to the management dashboard, though an admin can still visit `/advisor` and run a personal queue the same way any advisor does, if students are checking in to see them directly.

## If you're an admin

The admin dashboard has five tabs:

**Live Queue** shows every college's queue at once, read-only, useful for a front-desk or leadership view of the whole office rather than one advisor's line.

**Add Advisor** creates one advisor account at a time: name, email, college, and role.

**Bulk Upload** takes a CSV (`name,email,college_name,role`) and creates accounts in batch. It skips rows with a missing name or email, a duplicate email, or a college name that doesn't exactly match one already in the system, and tells you why each row was skipped.

**Manage Advisors** lists everyone with a toggle to activate or deactivate them and an edit button for their name, email, college, and role. Deactivating an advisor pulls them off the kiosk's dropdown immediately; it doesn't touch their past check-in history.

**Manage Colleges** toggles which colleges appear on the kiosk. Adding a brand-new college isn't available in the app yet: that still has to be done directly in Supabase.

## What the kiosk doesn't do

It's easy to assume this tool does more than it does. It doesn't send confirmation emails or texts to students, and it doesn't notify a student when you mark them seen. It doesn't check availability or prevent double-booking, since there's no real scheduling underneath it, just a first-come queue. It doesn't integrate with Starfish, Navigate, or the registrar. It doesn't print anything: the confirmation screen is on-screen only, gone as soon as the kiosk resets. And there's no reporting screen: every check-in is saved permanently, but no-shows, average wait times, or visit counts by month aren't available anywhere in the app. Pulling that kind of data means going into Supabase directly.

If you need real appointment scheduling, advising notes, or reporting beyond "who checked in and when," that still lives in whatever system you were using before the kiosk.
