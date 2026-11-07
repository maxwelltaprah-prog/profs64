-- Minimal stand-in for the parts of Supabase the migrations depend on, for running the
-- integration tests against plain Postgres when `supabase start` is unavailable (no Docker).
-- It is NOT Supabase: PostgREST, GoTrue and real JWT handling are absent. CI runs the same
-- tests against real local Supabase, where this file is not used.

-- Roles are cluster-wide, so tolerate them already existing (other databases in the cluster).
do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

create schema auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  aud text default 'authenticated',
  role text default 'authenticated',
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Same contract as Supabase's auth.uid(): the JWT subject, or null when unauthenticated.
create function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

-- Supabase's defaults grant API roles everything in public. Reproduce them so the
-- migration's explicit revokes are tested against realistic starting privileges.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
