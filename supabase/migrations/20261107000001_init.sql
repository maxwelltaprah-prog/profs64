-- Buildr core schema: profiles, projects, project_files, messages, credit_ledger, audit_log.
-- Row Level Security is enabled on every table with no default access. Policies grant the
-- minimum an end user needs; everything else goes through server-side functions that only
-- the service_role can execute. Reverse with supabase/down/20261107000001_init.down.sql.

set check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  -- Maintained only by public.record_credit_change(); users cannot write it.
  credit_balance numeric(12, 2) not null default 0 check (credit_balance >= 0),
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_owner_updated_idx on public.projects (owner_id, updated_at desc);

create table public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  path text not null,
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_files_unique_path unique (project_id, path),
  -- Mirrors lib/security path validation as a last line of defense.
  constraint project_files_path_safe check (
    char_length(path) between 1 and 255
    and path !~ '^/'
    and path !~ '\\'
    and path !~ '(^|/)\.\.(/|$)'
    and path !~ '%'
    and path ~ '\.(ts|tsx|js|jsx|json|css|html|md|svg|txt)$'
  ),
  constraint project_files_size_cap check (octet_length(content) <= 204800)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  parts jsonb not null check (jsonb_typeof(parts) = 'array' and octet_length(parts::text) <= 1048576),
  created_at timestamptz not null default now()
);
create index messages_project_created_idx on public.messages (project_id, created_at);

-- Append-only. user_id and project_id are nullable so account or project deletion can
-- anonymize history instead of destroying financial records.
create table public.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id) on delete set null,
  delta numeric(12, 2) not null check (delta <> 0),
  reason text not null check (reason in ('signup_grant', 'chat_usage', 'refund', 'admin_adjustment')),
  project_id uuid references public.projects (id) on delete set null,
  model text,
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  cost_usd numeric(12, 6) check (cost_usd >= 0),
  balance_after numeric(12, 2) not null check (balance_after >= 0),
  created_at timestamptz not null default now()
);
create index credit_ledger_user_created_idx on public.credit_ledger (user_id, created_at desc);

-- Append-only. Metadata must never contain PII, prompts, file contents or tokens.
create table public.audit_log (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id) on delete set null,
  event text not null check (char_length(event) between 1 and 64),
  metadata jsonb not null default '{}'::jsonb check (octet_length(metadata::text) <= 8192),
  request_id text check (char_length(request_id) <= 64),
  created_at timestamptz not null default now()
);
create index audit_log_user_created_idx on public.audit_log (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create function public.touch_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();
create trigger project_files_touch before update on public.project_files
  for each row execute function public.touch_updated_at();

-- Keeps a project's updated_at fresh when its files change so the dashboard sorts correctly.
create function public.bump_project_on_file_change() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.projects set updated_at = now()
  where id = coalesce(new.project_id, old.project_id);
  return null;
end;
$$;

create trigger project_files_bump after insert or update or delete on public.project_files
  for each row execute function public.bump_project_on_file_change();

-- Caps files per project. Locking the project row serializes concurrent inserts so two
-- parallel requests cannot both slip past the limit.
create function public.enforce_file_cap() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  file_count integer;
begin
  perform 1 from public.projects where id = new.project_id for update;
  select count(*) into file_count from public.project_files where project_id = new.project_id;
  if file_count >= 100 then
    raise exception 'project file limit reached' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger project_files_cap before insert on public.project_files
  for each row execute function public.enforce_file_cap();

-- Append-only enforcement for credit_ledger and audit_log. The only allowed UPDATE is
-- nulling user_id or project_id (anonymization from ON DELETE SET NULL); every other
-- column must stay identical. DELETE and TRUNCATE are always refused.
create function public.forbid_mutation() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - 'user_id' - 'project_id') = (to_jsonb(old) - 'user_id' - 'project_id')
       and (new.user_id is null or new.user_id is not distinct from old.user_id)
       and ((to_jsonb(new) ->> 'project_id') is null
            or (to_jsonb(new) ->> 'project_id') is not distinct from (to_jsonb(old) ->> 'project_id'))
    then
      return new;
    end if;
  end if;
  raise exception '% is append-only', tg_table_name using errcode = 'insufficient_privilege';
end;
$$;

create trigger credit_ledger_append_only before update or delete on public.credit_ledger
  for each row execute function public.forbid_mutation();
create trigger credit_ledger_no_truncate before truncate on public.credit_ledger
  for each statement execute function public.forbid_mutation();
create trigger audit_log_append_only before update or delete on public.audit_log
  for each row execute function public.forbid_mutation();
create trigger audit_log_no_truncate before truncate on public.audit_log
  for each statement execute function public.forbid_mutation();

-- ---------------------------------------------------------------------------
-- Credit functions (service_role only)
-- ---------------------------------------------------------------------------

-- The single place balances change. Locks the profile row so concurrent calls for one user
-- run one at a time, appends a ledger row and updates the balance in the same transaction.
-- A charge larger than the balance is clamped to the balance: the balance never goes
-- negative, and the shortfall is returned so the caller can log it.
create function public.record_credit_change(
  p_user_id uuid,
  p_delta numeric,
  p_reason text,
  p_project_id uuid default null,
  p_model text default null,
  p_input_tokens integer default null,
  p_output_tokens integer default null,
  p_cost_usd numeric default null
) returns table (applied_delta numeric, balance_after numeric, shortfall numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_balance numeric(12, 2);
  wanted numeric(12, 2) := round(p_delta, 2);
  applied numeric(12, 2);
  new_balance numeric(12, 2);
begin
  if wanted = 0 then
    raise exception 'delta must not be zero' using errcode = 'invalid_parameter_value';
  end if;

  select p.credit_balance into current_balance
  from public.profiles p where p.id = p_user_id for update;
  if not found then
    raise exception 'unknown user' using errcode = 'no_data_found';
  end if;

  applied := greatest(wanted, -current_balance);
  new_balance := current_balance + applied;

  if applied <> 0 then
    insert into public.credit_ledger
      (user_id, delta, reason, project_id, model, input_tokens, output_tokens, cost_usd, balance_after)
    values
      (p_user_id, applied, p_reason, p_project_id, p_model, p_input_tokens, p_output_tokens,
       p_cost_usd, new_balance);
    update public.profiles set credit_balance = new_balance where id = p_user_id;
  end if;

  return query select applied, new_balance, (wanted - applied) * -1;
end;
$$;

-- Atomic deduction used by the chat route. amount is positive.
create function public.deduct_credits(
  p_user_id uuid,
  p_amount numeric,
  p_project_id uuid,
  p_model text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_cost_usd numeric
) returns table (charged numeric, balance_after numeric, shortfall numeric)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive' using errcode = 'invalid_parameter_value';
  end if;
  return query
    select -r.applied_delta, r.balance_after, r.shortfall
    from public.record_credit_change(
      p_user_id, -p_amount, 'chat_usage', p_project_id, p_model,
      p_input_tokens, p_output_tokens, p_cost_usd
    ) r;
end;
$$;

-- Credits spent today (UTC) for the daily spend cap.
create function public.credits_spent_today(p_user_id uuid) returns numeric
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(sum(-delta), 0)::numeric
  from public.credit_ledger
  where user_id = p_user_id
    and reason = 'chat_usage'
    and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
$$;

create function public.record_audit_event(
  p_user_id uuid,
  p_event text,
  p_metadata jsonb default '{}'::jsonb,
  p_request_id text default null
) returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (user_id, event, metadata, request_id)
  values (p_user_id, p_event, coalesce(p_metadata, '{}'::jsonb), p_request_id);
$$;

-- Data export for privacy requests. Account deletion is `delete from auth.users`, which
-- cascades to profile, projects, files and messages and anonymizes ledger and audit rows.
create function public.export_user_data(p_user_id uuid) returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'profile', (select to_jsonb(p) from public.profiles p where p.id = p_user_id),
    'projects', coalesce((select jsonb_agg(to_jsonb(pr)) from public.projects pr where pr.owner_id = p_user_id), '[]'::jsonb),
    'files', coalesce((select jsonb_agg(to_jsonb(f)) from public.project_files f
                       join public.projects pr on pr.id = f.project_id where pr.owner_id = p_user_id), '[]'::jsonb),
    'messages', coalesce((select jsonb_agg(to_jsonb(m)) from public.messages m
                          join public.projects pr on pr.id = m.project_id where pr.owner_id = p_user_id), '[]'::jsonb),
    'credit_ledger', coalesce((select jsonb_agg(to_jsonb(l) order by l.id) from public.credit_ledger l where l.user_id = p_user_id), '[]'::jsonb),
    'audit_log', coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from public.audit_log a where a.user_id = p_user_id), '[]'::jsonb)
  );
$$;

-- New auth user: create the profile, grant 20 credits and record the signup.
create function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  perform public.record_credit_change(new.id, 20, 'signup_grant');
  insert into public.audit_log (user_id, event) values (new.id, 'signup');
  return new;
end;
$$;

-- Project deletion is a security-relevant event. Skipped when the owner's profile is already
-- gone, which is the account-deletion cascade (that path leaves its own trail: anonymized rows).
create function public.audit_project_deleted() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.profiles where id = old.owner_id) then
    insert into public.audit_log (user_id, event, metadata)
    values (old.owner_id, 'project_deleted', jsonb_build_object('project_id', old.id));
  end if;
  return old;
end;
$$;

create trigger projects_audit_delete after delete on public.projects
  for each row execute function public.audit_project_deleted();

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Privileges: default deny, then grant the minimum
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

-- Trigger functions run as their owner; no role needs to call them directly.
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.project_files to authenticated;
grant select, insert on public.messages to authenticated;
grant select on public.credit_ledger to authenticated;
grant select on public.audit_log to authenticated;

grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on function
  public.record_credit_change(uuid, numeric, text, uuid, text, integer, integer, numeric),
  public.deduct_credits(uuid, numeric, uuid, text, integer, integer, numeric),
  public.credits_spent_today(uuid),
  public.record_audit_event(uuid, text, jsonb, text),
  public.export_user_data(uuid)
to service_role;

-- Functions created later must not be callable by API roles by default.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_files enable row level security;
alter table public.messages enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.audit_log enable row level security;

alter table public.profiles force row level security;
alter table public.projects force row level security;
alter table public.project_files force row level security;
alter table public.messages force row level security;
alter table public.credit_ledger force row level security;
alter table public.audit_log force row level security;

-- service_role bypasses RLS in Supabase; make that explicit for forced-RLS tables.
create policy service_role_all_profiles on public.profiles for all to service_role using (true) with check (true);
create policy service_role_all_projects on public.projects for all to service_role using (true) with check (true);
create policy service_role_all_files on public.project_files for all to service_role using (true) with check (true);
create policy service_role_all_messages on public.messages for all to service_role using (true) with check (true);
create policy service_role_all_ledger on public.credit_ledger for all to service_role using (true) with check (true);
create policy service_role_all_audit on public.audit_log for all to service_role using (true) with check (true);

-- (select auth.uid()) is evaluated once per statement rather than once per row.
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy projects_select_own on public.projects for select to authenticated
  using (owner_id = (select auth.uid()));
create policy projects_insert_own on public.projects for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy projects_update_own on public.projects for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy projects_delete_own on public.projects for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy files_select_own on public.project_files for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid())));
create policy files_insert_own on public.project_files for insert to authenticated
  with check (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid())));
create policy files_update_own on public.project_files for update to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid())));
create policy files_delete_own on public.project_files for delete to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid())));

create policy messages_select_own on public.messages for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid())));
-- Users may only insert their own 'user' messages. Assistant messages are written by a
-- narrow server function so the API cannot be used to forge model output.
create policy messages_insert_user_role on public.messages for insert to authenticated
  with check (
    role = 'user'
    and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()))
  );

create policy ledger_select_own on public.credit_ledger for select to authenticated
  using (user_id = (select auth.uid()));
create policy audit_select_own on public.audit_log for select to authenticated
  using (user_id = (select auth.uid()));
