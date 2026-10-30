-- ============================================================
-- Migration: per-college kiosk settings, student assistant role,
-- hide-from-students flag, and "seen by" on queue entries.
-- Run against dev first, then prod after review.
-- ============================================================

-- 1. College-level kiosk settings
alter table public.colleges
  add column if not exists allow_next_available boolean not null default true,
  add column if not exists require_student_notes boolean not null default false;

comment on column public.colleges.allow_next_available is
  'When false, students cannot pick "Next Available" for Drop-In appointments in this college.';
comment on column public.colleges.require_student_notes is
  'When true, the kiosk "Notes for Advisor" field is required for this college.';

-- 2. Advisors: hide from the student advisor list
alter table public.advisors
  add column if not exists hide_from_students boolean not null default false;

comment on column public.advisors.hide_from_students is
  'When true, this person never appears in the kiosk advisor selection list.';

-- 3. New role: student_assistant (read-only view of the college queue)
alter table public.advisors drop constraint if exists advisors_role_check;
alter table public.advisors add constraint advisors_role_check
  check (role in ('platform_admin', 'system_admin', 'advisor', 'student_assistant'));

-- 4. Queue: which advisor actually saw the student (may differ from the
--    advisor the student selected, e.g. when a college admin steps in).
alter table public.queue
  add column if not exists seen_by_advisor_id uuid references public.advisors(id) on delete set null;

comment on column public.queue.seen_by_advisor_id is
  'Advisor who actually saw the student. Set by the advisor or by a college admin.';
