-- Allows queue.advisor_id to be NULL, which is how a "Next Available"
-- check-in is represented: not tied to any one advisor, so it appears on
-- the live queue of every advisor in the student's selected college.
-- Apply with `supabase db push` or run directly in the Supabase SQL editor
-- against the linked project.

alter table public.queue
  alter column advisor_id drop not null;

comment on column public.queue.advisor_id is
  'The advisor this student is here to see. NULL means "Next Available" — '
  'the student did not pick a specific advisor and should appear on every '
  'advisor''s queue in queue.college_id.';
