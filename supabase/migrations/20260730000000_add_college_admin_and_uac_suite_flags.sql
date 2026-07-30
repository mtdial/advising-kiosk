-- Adds the flags needed for college-admin queue visibility and UAC Suite
-- queue visibility. Apply with `supabase db push` or run directly in the
-- Supabase SQL editor against the linked project.

alter table public.advisors
  add column if not exists is_college_admin boolean not null default false,
  add column if not exists is_uac_suite     boolean not null default false,
  add column if not exists is_suite_admin   boolean not null default false;

comment on column public.advisors.is_college_admin is
  'When true, this user can view the live queue for every advisor in their own college_id.';
comment on column public.advisors.is_uac_suite is
  'Marks that this advisor''s office is physically located in the UAC Suite.';
comment on column public.advisors.is_suite_admin is
  'When true, this user can view the live queue for every advisor flagged is_uac_suite, across colleges.';
