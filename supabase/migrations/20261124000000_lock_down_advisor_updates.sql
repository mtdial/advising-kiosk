-- ============================================================
-- Migration: only admins can change advisor records.
--
-- Run against the dev project (bfthkkdgpzxwljdxzoss) first, verify,
-- then run against prod (ddnsecxxsdyvqgmufckr).
--
-- Why: the auth_update_advisors and auth_insert_advisors policies let any
-- signed-in user change or add any advisor row, including their own role
-- and admin flags. The Availability Grid reads role and is_college_admin
-- from this table for access (its spec, pre-launch item 1), so an advisor
-- could make themselves a system_admin from the browser console.
--
-- After this migration:
--   * platform_admin: can add and change any advisor.
--   * system_admin: can add and change advisors in their own school, and
--     cannot move a row to another school.
--   * everyone else: can change only office_hours_available on their own
--     row (the toggle on My Queue). Every other column stays as it was.
--   * The service role (create-advisor and the other Edge Functions) is
--     not affected: it bypasses RLS and this trigger.
-- Reads are unchanged.
-- ============================================================

-- The signed-in advisor, matched by lower-cased email like the rest of the kiosk.
create or replace function public.kiosk_current_advisor()
returns public.advisors
language sql stable security definer set search_path = '' as $$
  select a from public.advisors a
  where lower(a.email) = lower(auth.jwt() ->> 'email') and a.is_active
  order by a.created_at nulls last
  limit 1
$$;

-- Can the signed-in user add or change an advisor row in this school?
create or replace function public.kiosk_can_manage_advisor(p_school uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select me.role = 'platform_admin'
            or (me.role = 'system_admin' and me.school_id is not distinct from p_school)
     from (select (public.kiosk_current_advisor()).*) me),
    false)
$$;

revoke all on function public.kiosk_current_advisor() from public, anon;
revoke all on function public.kiosk_can_manage_advisor(uuid) from public, anon;
grant execute on function public.kiosk_current_advisor() to authenticated, service_role;
grant execute on function public.kiosk_can_manage_advisor(uuid) to authenticated, service_role;

-- Inserts: admins only (create-advisor uses the service role, so it is unaffected).
drop policy if exists auth_insert_advisors on public.advisors;
create policy auth_insert_advisors on public.advisors for insert to authenticated
  with check (public.kiosk_can_manage_advisor(school_id));

-- Updates: admins in scope, or the advisor's own row (the trigger below limits what changes).
drop policy if exists auth_update_advisors on public.advisors;
create policy auth_update_advisors on public.advisors for update to authenticated
  using (public.kiosk_can_manage_advisor(school_id) or lower(email) = lower(auth.jwt() ->> 'email'))
  with check (public.kiosk_can_manage_advisor(school_id) or lower(email) = lower(auth.jwt() ->> 'email'));

-- On their own row a non-admin may change office_hours_available and nothing else.
-- SECURITY INVOKER on purpose: current_user must be the caller's role, which a
-- SECURITY DEFINER function would replace with its owner.
create or replace function public.advisors_guard_self_update()
returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;  -- service role, postgres, dashboard
  end if;
  if public.kiosk_can_manage_advisor(old.school_id) and public.kiosk_can_manage_advisor(new.school_id) then
    return new;
  end if;
  if (to_jsonb(new) - 'office_hours_available') is distinct from (to_jsonb(old) - 'office_hours_available') then
    raise exception 'only_admins_can_change_advisors: only an admin can change advisor details'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists advisors_guard_self_update on public.advisors;
create trigger advisors_guard_self_update
  before update on public.advisors
  for each row execute function public.advisors_guard_self_update();
