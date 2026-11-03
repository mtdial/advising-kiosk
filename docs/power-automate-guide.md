# Nightly Queue Export — Power Automate Setup Guide

This flow runs every night, pulls all rows from the Supabase `queue` table,
saves them as a dated CSV in SharePoint, then calls the `clear-queue` Edge
Function to wipe the table for the new day.

---

## Before you start

You need two values from the Supabase Dashboard:

1. **Supabase URL** — `https://ddnsecxxsdyvqgmufckr.supabase.co`
2. **Service Role Key** — Dashboard → Settings → API → `service_role` (secret)
   ⚠️ Treat this like a password. Store it using Power Automate's secure inputs
   (see Step 1 below) — never paste it in plain text.

---

## Step 1 — Create the flow

1. Go to **make.powerautomate.com** → **Create** → **Scheduled cloud flow**
2. Name it: `Nightly Advising Queue Export`
3. Set the recurrence:
   - Frequency: **Day**
   - Time: **11:55 PM** (or your preferred cutoff time)
   - Time zone: **(UTC-05:00) Eastern Time (US & Canada)**

---

## Step 2 — Fetch queue data from Supabase

Add action: **HTTP**

| Field | Value |
|---|---|
| Method | `GET` |
| URI | `https://ddnsecxxsdyvqgmufckr.supabase.co/rest/v1/queue?select=student_name,student_email,major,appointment_type,status,checked_in_at,college_id,advisor_id&order=checked_in_at.asc` |
| Header: `apikey` | *(your service role key)* |
| Header: `Authorization` | `Bearer ` + *(your service role key)* |

> To store the key securely: in the HTTP action, click the value field → choose
> **Expression** → use `parameters('ServiceRoleKey')` — or store it as a
> Power Automate **connection parameter** / **environment variable**.

---

## Step 3 — Parse the response

Add action: **Parse JSON**

- **Content**: `Body` (output of the HTTP action)
- **Schema**: Click **Generate from sample**, paste in a sample row from your
  queue table. If the queue is empty, use this:

```json
[
  {
    "student_name": "Jane Doe",
    "student_email": "jdoe@email.sc.edu",
    "major": "Biology",
    "appointment_type": "Walk-in",
    "status": "waiting",
    "checked_in_at": "2026-08-25T14:30:00+00:00",
    "college_id": "00000000-0000-0000-0000-000000000001",
    "advisor_id": null
  }
]
```

---

## Step 4 — Build the CSV

Add action: **Create CSV table**

- **From**: `Body` (output of Parse JSON)
- **Columns**: Automatic (Power Automate will use all fields)

---

## Step 5 — Save to SharePoint

Add action: **SharePoint — Create file**

| Field | Value |
|---|---|
| Site Address | *(your UAC SharePoint site URL)* |
| Folder Path | `/Queue Archives` *(or wherever you want them)* |
| File Name | `queue-@{formatDateTime(utcNow(), 'yyyy-MM-dd')}.csv` |
| File Content | Output of the **Create CSV table** action |

> Power Automate will create `/Queue Archives/queue-2026-08-25.csv` each night.
> Create the `/Queue Archives` folder in SharePoint first if it doesn't exist.

---

## Step 6 — Confirm the file saved (condition)

Add action: **Condition**

- Check that the SharePoint action's **Status code** equals `201`
  (Created) — this prevents the queue from being cleared if the file save
  failed.

**If yes** → continue to Step 7  
**If no** → add a **Send an email (V2)** action to alert your team, then
**Terminate** the flow with status `Failed`

---

## Step 7 — Clear the Supabase queue

Add action: **HTTP** (inside the "If yes" branch)

| Field | Value |
|---|---|
| Method | `POST` |
| URI | `https://ddnsecxxsdyvqgmufckr.supabase.co/functions/v1/clear-queue` |
| Header: `Authorization` | `Bearer ` + *(your service role key)* |
| Header: `Content-Type` | `application/json` |
| Body | `{}` |

The function returns `{ "success": true, "cleared": 12, "clearedAt": "..." }`.

---

## Step 8 — (Optional) Send a confirmation email

Add action: **Send an email (V2)**

- **To**: your team or shared inbox
- **Subject**: `Queue archived — @{formatDateTime(utcNow(), 'MMMM d, yyyy')}`
- **Body**: Paste in the response body from Step 7 so you can see how many
  rows were cleared each night.

---

## Deploying the Edge Function

Before the flow can work, deploy the `clear-queue` function to Supabase:

```bash
supabase functions deploy clear-queue --project-ref ddnsecxxsdyvqgmufckr
```

Run this from the `advising-kiosk` folder after confirming in dev.

---

## Testing

1. Run the flow manually (**Test → Manually → Run flow**)
2. Check SharePoint for the CSV file
3. Verify the `queue` table in Supabase is empty
4. Add a test row back in before going live

---

## What lives where after this

| Data | Location |
|---|---|
| Live queue (today) | Supabase `queue` table |
| Past daily archives | SharePoint `/Queue Archives/queue-YYYY-MM-DD.csv` |
| Supabase storage used | Near zero — no accumulation |
