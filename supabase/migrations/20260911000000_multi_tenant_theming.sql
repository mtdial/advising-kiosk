-- ============================================================
-- Migration: multi-tenant theming (schools table, campus admin
-- role, per-school logo storage)
--
-- Run against the dev project first (bfthkkdgpzxwljdxzoss), verify,
-- then run against prod (ddnsecxxsdyvqgmufckr) only after Mike
-- confirms in review.
--
-- The `schools` table did not exist before this migration — it is
-- created here, not just altered. Only `advisors` gets new columns
-- on top of its existing schema.
--
-- Column-to-base-palette mapping (confirmed with Mike):
--   primary_color   = Ink            #0E0E0D
--   accent_color    = Bridge Gold    #B29F56
--   nav_fill_color  = Panther Navy   #003162
--   nav_shelf_color = Cocked Garnet  #6A0009
--   link_color      = Warm Graphite  #6E6C68
--   hover_color     = Parchment      #F7F4EC
-- This is the default new schools get. USC's own row is seeded
-- below with its current live garnet/lime look instead, so
-- switching to CSS-variable theming does not change USC's
-- appearance:
--   primary_color = nav_fill_color = link_color = #73000a (garnet)
--   accent_color                              = #CED318 (lime)
--   nav_shelf_color = hover_color             = #570008 (dark garnet hover shade)
-- ============================================================

-- 1. Schools table --------------------------------------------------------------
create table if not exists public.schools (
  id              uuid        primary key default gen_random_uuid(),
  name            text        not null,
  theme_name      text        not null default 'Default',
  primary_color   text        not null default '#0E0E0D',
  accent_color    text        not null default '#B29F56',
  nav_fill_color  text        not null default '#003162',
  nav_shelf_color text        not null default '#6A0009',
  link_color      text        not null default '#6E6C68',
  hover_color     text        not null default '#F7F4EC',
  logo_url        text,
  created_at      timestamptz not null default now()
);

comment on table public.schools is
  'One row per tenant institution. The color columns are applied at runtime as CSS custom properties (see ThemeContext).';

-- 2. Seed the USC row (idempotent) -----------------------------------------------
insert into public.schools
  (name, theme_name, primary_color, accent_color, nav_fill_color, nav_shelf_color, link_color, hover_color)
select
  'University of South Carolina', 'USC Garnet', '#73000a', '#CED318', '#73000a', '#570008', '#73000a', '#570008'
where not exists (select 1 from public.schools where name = 'University of South Carolina');

-- 3. Tenant columns on advisors ---------------------------------------------------
alter table public.advisors
  add column if not exists school_id       uuid references public.schools(id),
  add column if not exists is_campus_admin boolean not null default false;

comment on column public.advisors.school_id is
  'The tenant this advisor belongs to. Drives which schools row is used for theming and scopes campus-admin edits to that row.';
comment on column public.advisors.is_campus_admin is
  'When true, this user can edit their own school''s branding at /theme-settings. Full admins (role = ''admin'') can always edit their own school''s branding too.';

-- Backfill every existing advisor onto the USC row so nothing breaks.
update public.advisors
set school_id = (select id from public.schools where name = 'University of South Carolina')
where school_id is null;

-- Safety net: until the app has a real "choose a school" UI, default any
-- newly-created advisor (e.g. via the create-advisor function or bulk upload)
-- onto the first school row rather than leaving school_id null.
create or replace function public.set_default_advisor_school_id()
returns trigger as $$
begin
  if new.school_id is null then
    select id into new.school_id from public.schools order by created_at asc limit 1;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists advisors_default_school_id on public.advisors;
create trigger advisors_default_school_id
  before insert on public.advisors
  for each row execute function public.set_default_advisor_school_id();

-- 4. Row Level Security on schools -------------------------------------------------
alter table public.schools enable row level security;

-- Everyone (including the anon kiosk) can read school branding — needed to
-- theme the public check-in page before anyone is signed in.
drop policy if exists "Public read schools" on public.schools;
create policy "Public read schools"
  on public.schools for select
  using (true);

grant select on public.schools to anon, authenticated;

-- Only a campus admin (or full admin) may update a schools row, and only
-- their OWN school. school_id is resolved server-side from the advisors row
-- matched to the caller's own JWT email — a school_id sent from the client
-- is never trusted.
drop policy if exists "Campus admins manage own school" on public.schools;
create policy "Campus admins manage own school"
  on public.schools for update
  using (
    exists (
      select 1 from public.advisors a
      where lower(a.email) = lower(auth.jwt() ->> 'email')
        and a.is_active
        and (a.role = 'admin' or a.is_campus_admin)
        and (a.role = 'admin' or a.school_id = schools.id)
    )
  )
  with check (
    exists (
      select 1 from public.advisors a
      where lower(a.email) = lower(auth.jwt() ->> 'email')
        and a.is_active
        and (a.role = 'admin' or a.is_campus_admin)
        and (a.role = 'admin' or a.school_id = schools.id)
    )
  );

-- 5. Storage bucket + RLS for per-school logos --------------------------------------
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

-- Public read (the kiosk and nav bar render the logo unauthenticated)
drop policy if exists "Public read logos" on storage.objects;
create policy "Public read logos"
  on storage.objects for select
  using (bucket_id = 'logos');

-- Campus admins (or full admins) may write only under their own school's
-- folder: logos/{school_id}/logo.png. Path is checked server-side against
-- the caller's own advisors.school_id, never against a client-supplied value.
drop policy if exists "Campus admins write own school logo" on storage.objects;
create policy "Campus admins write own school logo"
  on storage.objects for insert
  with check (
    bucket_id = 'logos'
    and exists (
      select 1 from public.advisors a
      where lower(a.email) = lower(auth.jwt() ->> 'email')
        and a.is_active
        and (a.role = 'admin' or a.is_campus_admin)
        and (a.role = 'admin' or a.school_id::text = (storage.foldername(name))[1])
    )
  );

drop policy if exists "Campus admins update own school logo" on storage.objects;
create policy "Campus admins update own school logo"
  on storage.objects for update
  using (
    bucket_id = 'logos'
    and exists (
      select 1 from public.advisors a
      where lower(a.email) = lower(auth.jwt() ->> 'email')
        and a.is_active
        and (a.role = 'admin' or a.is_campus_admin)
        and (a.role = 'admin' or a.school_id::text = (storage.foldername(name))[1])
    )
  );

-- Done. All changes are additive — no data loss.
