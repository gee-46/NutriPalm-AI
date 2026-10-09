-- Minimal emulation of the parts of a Supabase project that the NutriPalm
-- migrations depend on, for running them on a plain throwaway Postgres.
--
-- THIS IS NOT SUPABASE. A real project already provides all of this. It exists
-- only so the migrations and RLS policies can be exercised on a local Postgres
-- engine. Keep it faithful to Supabase's documented behaviour:
--   * roles anon / authenticated (RLS applies) and service_role (BYPASSRLS)
--   * auth.users table, auth.uid() / auth.role() reading the PostgREST JWT GUCs
--   * default privileges that expose public tables to those roles

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema if not exists auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Same resolution order as Supabase: individual claim GUC, then the claims JSON.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant execute on function auth.role() to anon, authenticated, service_role;

-- Supabase grants table privileges broadly and relies on RLS for isolation.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
