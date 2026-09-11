-- ============================================================
-- Migration: split the old single "admin" role into platform_admin
-- (cross-tenant, no boundaries) and system_admin (scoped to their
-- own school), and give colleges + queue a school_id so the admin
-- panel and future admin views can actually be scoped per tenant.
--
-- Run against the dev project (bfthkkdgpzxwljdxzoss) first, verify,
-- then run against prod (ddnsecxxsdyvqgmufckr) only after Mike
-- confirms in review.
--
-- Why: today's role='admin' is a global override with no school_id
-- boundary anywhere (the /admin panel's Live Queue, Manage Advisors,
-- Manage Colleges and Bulk Upload all query advisors/queue/colleges
-- with zero school_id filter, and create-advisor doesn't stamp a
-- school_id on new advisors at all). That's fine with one tenant,
-- but it means any admin at campus B would see and edit campus A's
-- roster and queue the moment a second school exists. This migration
-- doesn't change what admins can DO — it draws the tenant boundary
-- that was missing so scoping is actually possible.
-- ============================================================

-- 1. Give colleges a tenant ------------------------------------------------------
alter table public.colleges
  add column if not exists school_id uuid references public.schools(id);

comment on column public.colleges.school_id is
  'The tenant this college/department belongs to. Every college belongs to exactly one school.';

update public.colleges
set school_id = (select id from public.schools where name = 'University of South Carolina')
where school_id is null;

-- Colleges are currently added by hand in the Supabase dashboard (no UI for
-- it yet) — default any new one onto the first school row rather than
-- leaving school_id null, same safety net as advisors already has.
create or replace function public.set_default_college_school_id()
returns trigger as $$
begin
  if new.school_id is null then
    select id into new.school_id from public.schools order by created_at asc limit 1;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists colleges_default_school_id on public.colleges;
create trigger colleges_default_school_id
  before insert on public.colleges
  for each row execute function public.set_default_college_school_id();

-- 2. Give queue entries a tenant (denormalized from college_id) ------------------
alter table public.queue
  add column if not exists school_id uuid references public.schools(id);

comment on column public.queue.school_id is
  'Denormalized from the queue entry''s college at check-in time, so admin views can scope to one tenant without a join. Set automatically — never trust a client-supplied value.';

update public.queue q
set school_id = c.school_id
from public.colleges c
where q.college_id = c.id
  and q.school_id is null;

-- Any queue rows with no college_id fall back to the first school.
update public.queue
set school_id = (select id from public.schools order by created_at asc limit 1)
where school_id is null;

create or replace function public.set_default_queue_school_id()
returns trigger as $$
begin
  if new.school_id is null then
    if new.college_id is not null then
      select school_id into new.school_id from public.colleges where id = new.college_id;
    end if;
    if new.school_id is null then
      select id into new.school_id from public.schools order by created_at asc limit 1;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists queue_default_school_id on public.queue;
create trigger queue_default_school_id
  before insert on public.queue
  for each row execute function public.set_default_queue_school_id();

-- 3. Split the role ---------------------------------------------------------------
-- Every existing role='admin' advisor keeps exactly the capabilities they have
-- today, just now bounded to their own school_id (which the theming migration
-- already backfilled everyone onto USC's row, so nothing changes for them yet).
update public.advisors set role = 'system_admin' where role = 'admin';

alter table public.advisors drop constraint if exists advisors_role_check;
alter table public.advisors add constraint advisors_role_check
  check (role in ('platform_admin', 'system_admin', 'advisor'));

comment on column public.advisors.role is
  'platform_admin: cross-tenant, no school_id boundary, can manage every school. system_admin: full admin rights within their own school_id only (this was the old "admin" value). advisor: no admin panel access.';

-- Promote Mike to the one cross-tenant role.
update public.advisors
set role = 'platform_admin'
where lower(email) = lower('mdial@mailbox.sc.edu');

-- 4. Fix the schools RLS policy from today's theming migration -------------------
-- The original policy let ANY role='admin' edit ANY school's branding (that was
-- the correct behavior for a single-tenant app, but is exactly the global-override
-- bug this migration exists to close). Now: platform_admin can edit any school;
-- system_admin or is_campus_admin can edit only their own.
drop policy if exists "Campus admins manage own school" on public.schools;
create policy "Campus admins manage own school"
  on public.schools for update
  using (
    exists (
      select 1 from public.advisors a
      where lower(a.email) = lower(auth.jwt() ->> 'email')
        and a.is_active
        and (
          a.role = 'platform_admin'
          or ((a.role = 'system_admin' or a.is_campus_admin) and a.school_id = schools.id)
        )
    )
  )
  with check (
    exists (
      select 1 from public.advisors a
      where lower(a.email) = lower(auth.jwt() ->> 'email')
        and a.is_active
        and (
          a.role = 'platform_admin'
          or ((a.role = 'system_admin' or a.is_campus_admin) and a.school_id = schools.id)
        )
    )
  );

-- 5. Same fix for the per-school logo storage policies ----------------------------
drop policy if exists "Campus admins write own school logo" on storage.objects;
create policy "Campus admins write own school logo"
  on storage.objects for insert
  with check (
    bucket_id = 'logos'
    and exists (
      select 1 from public.advisors a
      where lower(a.email) = lower(auth.jwt() ->> 'email')
        and a.is_active
        and (
          a.role = 'platform_admin'
          or ((a.role = 'system_admin' or a.is_campus_admin) and a.school_id::text = (storage.foldername(name))[1])
        )
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
        and (
          a.role = 'platform_admin'
          or ((a.role = 'system_admin' or a.is_campus_admin) and a.school_id::text = (storage.foldername(name))[1])
        )
    )
  );

-- Done. All changes are additive except the two RLS policy replacements above,
-- which close the global-override gap rather than open anything new.
-- NOT included here (flagged for a follow-up pass, not silently skipped):
--   - advisors / queue / colleges have no RLS at all yet (predates this
--     migration) — worth auditing before onboarding a second school.
--   - SuiteAdminPage and EASuiteAdminPage query is_uac_suite / ea_suite
--     across ALL colleges with no school_id filter, unlike CollegeAdminPage
--     (which is already safe — it's scoped to one college_id, and every
--     college now belongs to exactly one school).
