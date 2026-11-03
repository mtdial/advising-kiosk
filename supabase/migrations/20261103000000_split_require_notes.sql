-- ============================================================
-- Migration: split require_student_notes into separate settings
-- for scheduled appointments and drop-ins.
-- Run against dev first, then prod after review.
-- ============================================================

alter table public.colleges
  add column if not exists require_notes_scheduled boolean not null default false,
  add column if not exists require_notes_dropin boolean not null default false;

-- Preserve existing behavior: colleges that required notes keep requiring them for both types.
update public.colleges
  set require_notes_scheduled = true,
      require_notes_dropin = true
  where require_student_notes = true;

comment on column public.colleges.require_notes_scheduled is
  'When true, the kiosk "Notes for Advisor" field is required for Scheduled Advising Appointments.';
comment on column public.colleges.require_notes_dropin is
  'When true, the kiosk "Notes for Advisor" field is required for Office Hours: Drop-In.';
comment on column public.colleges.require_student_notes is
  'Deprecated: replaced by require_notes_scheduled and require_notes_dropin.';
