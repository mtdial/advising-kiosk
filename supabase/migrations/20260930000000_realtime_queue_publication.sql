-- Ensure public.queue is published to Supabase Realtime.
-- Idempotent: safe to re-run, and a no-op where the table is already published.
--
-- REPLICA IDENTITY is intentionally left at DEFAULT. The client only filters on
-- columns of the new row (college_id, school_id), and DELETE payloads carry just
-- the primary key, which is all the client needs to drop a row.
--
-- RLS: existing policies already let `authenticated` SELECT queue rows, which is
-- what Realtime uses to authorize events. `anon` only inserts and never subscribes.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'queue'
  ) then
    alter publication supabase_realtime add table public.queue;
  end if;
end $$;
