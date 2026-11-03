# Advisor and College Record Options

This is a reference for every setting an admin can choose on an advisor record and on a college record. Settings are managed in the Admin dashboard (`/admin`). Advisors are managed under Add Advisor, Bulk Upload, and Manage Advisors. Colleges are managed under Manage Colleges.

---

## Advisor records

### Where each option can be set

| Option | Add Advisor | Bulk Upload | Manage Advisors (Edit) |
|---|---|---|---|
| Full Name | Yes | Yes (`name`) | Yes |
| Email | Yes | Yes (`email`) | Yes |
| College | Yes | Yes (`college_name` or `college`) | Yes |
| Start Date | Yes | Yes (`start_date`) | Yes |
| Role | Yes | Yes (`role`) | Yes |
| Access & Status toggles | No | No | Yes |
| Assigned Majors | No | No | Yes |
| Password reset | No | No | Yes |

New accounts start with every toggle off except Active. Turn the other toggles on after the account exists.

### Core fields

**Full Name and Email.** Both are required. The email is the login and must be unique. Emails are saved in lowercase. If you change an email to one already in use, the save fails with "That email is already in use."

**College.** Optional. Pick one college or "No college assigned." The college controls which students can choose this advisor on the kiosk, and which College Queue the advisor belongs to. In Bulk Upload the name must exactly match an existing college, or the row is skipped.

**Start Date.** Optional. The advisor's first day at the UAC. Staff meetings before this date do not count for the advisor. Leave it blank for no cutoff. Bulk Upload accepts `2024-08-19` or `8/19/2024`. A date in any other format skips that row.

**Role.** One of four:

| Role | What it means |
|---|---|
| Advisor | Has their own queue. Appears on the kiosk. This is the default. |
| Student Assistant | Never appears on the kiosk and has no personal queue. Lands on the College Queue in read-only mode (unless they also hold the College Admin toggle). |
| System Admin | Full access to the Admin dashboard for their own school. |
| Platform Admin | Full access across all schools. Only a Platform Admin can assign this role. |

In Bulk Upload, the older value `admin` is read as System Admin.

### Access & Status toggles (Manage Advisors → Edit)

| Toggle | Effect when on |
|---|---|
| Active | Advisor can appear in the kiosk advisor list. Turn off to pull someone from the kiosk without touching their past check-ins. |
| Do not display on student selection | Advisor is hidden from the kiosk advisor list even if Active. Use this for people who need a login but should not be bookable. |
| College Admin | Adds the College Queue tab, scoped to the advisor's own college. |
| UAC Suite | Tags the advisor as working in the UAC Suite. Their students show up in the Suite Queue. This grants no access by itself. |
| Suite Admin | Adds the Suite Queue tab, covering every advisor tagged UAC Suite. |
| EA Suite | Tags the advisor as working in the EA Suite. Their students show up in the EA Suite Queue. |
| EA Suite Admin | Adds the EA Suite Queue tab. |
| Campus Admin (Theme Settings) | Gives access to the Theme Settings page. |

An advisor appears on the kiosk only when all of these are true: Active is on, "Do not display on student selection" is off, the role is not Student Assistant, and their college matches what the student picked. For Office Hours: Drop-In, the advisor must also have turned on their own office hours availability.

### Assigned Majors

Shown in the Edit window once a college is selected. It lists the active majors for that college.

- Check one or more majors to limit this advisor to students in those majors.
- Leave all unchecked to advise all majors.
- This only filters the kiosk when the college has "Require Major" turned on and the student has picked a major.

### Password

"Reset password to default" in the Edit window sets the advisor's password back to the default. It asks for confirmation first. There is no self-service "forgot password" link. Only a Platform Admin can reset another Platform Admin's password.

### Other things an admin can do from an advisor record

- **View as advisor.** Opens that advisor's queue in a new tab so you can see what they see.
- **Filter the advisor list** by search (name or email), status, college, role, College Admin yes or no, and assigned major (any, none, or a specific major).
- **Sort** the list by name, college, or role.

### Set by the advisor, not the admin

**Office hours available.** Each advisor turns this on or off on their own queue page. It controls whether they appear on the kiosk for drop-ins.

---

## College records

All college settings are toggles on one row in Manage Colleges. Changes save immediately. Adding or removing a college is not available in the app. That is still done directly in Supabase.

| Setting | Default | Effect |
|---|---|---|
| Active | On | Controls whether the college appears in the kiosk college dropdown. Inactive colleges are also left out of the college lists on the Add Advisor, Bulk Upload, and Edit Advisor forms. |
| Require Major | Off | When on, the kiosk shows a major dropdown after the student picks this college. Once a major is chosen, the advisor list narrows to advisors assigned to that major, plus advisors with no majors assigned. |
| Allow "Next Available" | On | When on, students checking in for Office Hours: Drop-In can pick Next Available instead of a named advisor. When off, they must pick a specific advisor. |
| Require Notes (Scheduled) | Off | When on, the "Notes for Advisor" field is required for Scheduled Advising Appointments in this college. |
| Require Notes (Drop-In) | Off | When on, the "Notes for Advisor" field is required for Office Hours: Drop-In in this college. |

Notes about these settings:

- The two notes settings replaced a single "require notes" setting. Colleges that required notes before keep requiring them for both appointment types.
- Next Available only applies to drop-ins. A Scheduled Advising Appointment always needs a named advisor.
- A college with Require Major off shows no major dropdown, so Assigned Majors on advisors has no effect there.
- The list of majors for each college is not editable in the Admin dashboard.

---

## Who sees what

- A System Admin sees and manages records for their own school only.
- A Platform Admin can switch between schools or view All Schools. Add Advisor and Bulk Upload need a specific school selected, because every new advisor lands on one school.
- The School column appears in the lists only when a Platform Admin is viewing All Schools.
