-- The database of Oito Lados (Supabase): one row per person, with the whole state of the app as it is on the device,
-- and the latest fights of the athletes that person's devices read from ESPN.
-- Run once in the SQL Editor of the project. Running it again changes nothing.
-- Who may read or write what is decided here, by the policies below, and not by keeping the address or the
-- publishable key hidden: those go in the page.

create table if not exists public.states (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- a ceiling on the size of a row: with sign-ups open, nobody can fill the 500 MB of the free plan with one account.
-- 2 MB is some thousands of bets; the app says when a sync is refused.
do $$ begin
  alter table public.states add constraint states_size check (octet_length(data::text) <= 2000000);
exception when duplicate_object then null; end $$;

alter table public.states enable row level security;
-- Supabase grants everything on new tables to anon and authenticated by default: here only what is used is left.
-- anon may select so the daily routine can count; with no policy for anon it sees no row. Nobody may delete.
revoke all on table public.states from anon, authenticated;
grant select, insert, update on table public.states to authenticated;
grant select on table public.states to anon;

-- each person reads and writes their own row, and nobody else's
drop policy if exists "own row: read" on public.states;
create policy "own row: read" on public.states for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "own row: insert" on public.states;
create policy "own row: insert" on public.states for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "own row: update" on public.states;
create policy "own row: update" on public.states for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- The latest fights of each athlete, as one device read them from ESPN, so the other device of the same person does
-- not read them again (D103). Each person has their own rows: what somebody else wrote is never read, so nobody can
-- put made-up fights on anybody's screen. The app checks every row again before using it (Core.formRows).
create table if not exists public.form_cache (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  athlete    text not null check (athlete ~ '^[A-Za-z0-9_-]{1,40}$'),
  data       jsonb not null check (octet_length(data::text) <= 16384),
  fetched_at timestamptz not null,
  primary key (user_id, athlete)
);

alter table public.form_cache enable row level security;
-- not logged in, nothing at all; logged in, read and write but never delete
revoke all on table public.form_cache from anon, authenticated;
grant select, insert, update on table public.form_cache to authenticated;

drop policy if exists "own rows: read" on public.form_cache;
create policy "own rows: read" on public.form_cache for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "own rows: insert" on public.form_cache;
create policy "own rows: insert" on public.form_cache for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "own rows: update" on public.form_cache;
create policy "own rows: update" on public.form_cache for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- what the daily routine calls (api/keepalive.ts): a query on the table, as an anonymous caller, so it sees no row
create or replace function public.keepalive() returns integer
  language sql stable security invoker set search_path = ''
  as $$ select count(*)::integer from public.states $$;
revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;
