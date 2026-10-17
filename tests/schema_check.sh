#!/usr/bin/env bash
# The database schema (supabase/schema.sql) run on a local Postgres, with the bits of Supabase it relies on imitated:
# the anon and authenticated roles, auth.users, auth.uid() read from the token, and the default grants Supabase gives
# to new tables. Checks that each person reads and writes only their own row, that nobody deletes, that the daily
# routine counts as anon without seeing any row, and that running the schema twice changes nothing.
#   tests/schema_check.sh          (needs the Postgres server binaries; exit 3 when they are missing)
# What is imitated is not Supabase: the real project is checked once it exists (docs/verificacao.md).
set -euo pipefail
cd "$(dirname "$0")/.."
BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -n 1)}"
if [ -z "$BIN" ] || [ ! -x "$BIN/initdb" ]; then echo "schema: sem os binários do Postgres (PG_BIN)" >&2; exit 3; fi

DIR="$(mktemp -d)"; chmod 777 "$DIR"
RUN=(); if [ "$(id -u)" = 0 ]; then id pgcheck >/dev/null 2>&1 || useradd -M pgcheck; RUN=(runuser -u pgcheck --); chown pgcheck "$DIR"; fi
cleanup() { "${RUN[@]}" "$BIN/pg_ctl" -D "$DIR/db" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap cleanup EXIT
"${RUN[@]}" "$BIN/initdb" -D "$DIR/db" -U postgres -A trust >/dev/null
"${RUN[@]}" "$BIN/pg_ctl" -D "$DIR/db" -o "-k $DIR -c listen_addresses=''" -l "$DIR/log" -w start >/dev/null
q() { "$BIN/psql" -h "$DIR" -U postgres -d postgres -v ON_ERROR_STOP=1 -qAt "$@"; }

q <<'SQL'
create role anon nologin; create role authenticated nologin;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
create schema auth; grant usage on schema auth to anon, authenticated;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
insert into auth.users values ('00000000-0000-0000-0000-00000000000a', 'a@exemplo.com'), ('00000000-0000-0000-0000-00000000000b', 'b@exemplo.com');
SQL
q -f supabase/schema.sql
q -f supabase/schema.sql          # a second run changes nothing and does not fail

A=00000000-0000-0000-0000-00000000000a; B=00000000-0000-0000-0000-00000000000b
as() { local role="$1" sub="$2"; shift 2; q -c "set role $role; select set_config('request.jwt.claim.sub', '$sub', false);" -c "$@" | tail -n 1; }
fails=0; n=0
expect() { n=$((n+1)); if [ "$2" != "$3" ]; then fails=$((fails+1)); echo "FAIL $1: got '$2', want '$3'"; fi; }
denied() { n=$((n+1)); if out="$(as "$2" "$3" "$4" 2>&1)"; then fails=$((fails+1)); echo "FAIL $1: went through ($out)"; fi; }

expect 'a person writes their own row' "$(as authenticated $A "insert into public.states (user_id, data) values ('$A', '{\"bets\":[],\"deposits\":[{\"t\":1,\"v\":100}]}') returning 1")" '1'
expect 'the user id defaults to the one of the token' "$(as authenticated $B "insert into public.states (data) values ('{\"bets\":[],\"deposits\":[]}') returning user_id")" "$B"
denied 'nobody writes a row for somebody else' authenticated $B "insert into public.states (user_id, data) values ('$A', '{}')"
expect 'a person reads only their own row' "$(as authenticated $B "select count(*) from public.states")" '1'
expect 'and it is theirs' "$(as authenticated $A "select data->'deposits'->0->>'v' from public.states")" '100'
expect 'nobody changes somebody else'"'"'s row' "$(as authenticated $B "with x as (update public.states set data = '{}' where user_id = '$A' returning 1) select count(*) from x")" '0'
expect 'the upsert of the app updates the own row' "$(as authenticated $A "insert into public.states (user_id, data) values ('$A', '{\"bets\":[1],\"deposits\":[]}') on conflict (user_id) do update set data = excluded.data returning jsonb_array_length(data->'bets')")" '1'
denied 'nobody deletes, not even their own row' authenticated $A "delete from public.states where user_id = '$A'"
expect 'without login nothing is seen' "$(as anon '' "select count(*) from public.states")" '0'
denied 'without login nothing is written' anon '' "insert into public.states (user_id, data) values ('$A', '{}')"
expect 'the routine of the cron runs as anon and sees no row' "$(as anon '' "select public.keepalive()")" '0'
expect 'both rows are still there' "$(q -c "select count(*) from public.states")" '2'
denied 'a row past the ceiling of 2 MB is refused' authenticated $A "update public.states set data = jsonb_build_object('bets', '[]'::jsonb, 'deposits', '[]'::jsonb, 'pad', repeat('x', 2000001)) where user_id = '$A'"
expect 'row level security is on' "$(q -c "select relrowsecurity from pg_class where oid = 'public.states'::regclass")" 't'

echo "$((n - fails))/$n schema checks passed"
[ "$fails" -eq 0 ]
