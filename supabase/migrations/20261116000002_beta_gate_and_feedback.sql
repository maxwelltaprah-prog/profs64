-- Closed beta: only listed people can create an account, and testers can send feedback.
--
-- The gate is a trigger on auth.users, so it covers every way an account can be created (the
-- sign-up form, Google sign-in, anything else), not only our own form. It is ON by default. An
-- email is allowed when the beta_allowlist holds the full address ("a@b.com") or its domain
-- ("@b.com"). To open sign-up to everyone later: update public.app_settings set value = 'off'
-- where key = 'beta_gate';
-- Reverse with supabase/down/20261116000002_beta_gate_and_feedback.down.sql.

create table public.app_settings (
  key text primary key check (char_length(key) between 1 and 64),
  value text not null check (char_length(value) <= 200),
  updated_at timestamptz not null default now()
);
insert into public.app_settings (key, value) values ('beta_gate', 'on');

create table public.beta_allowlist (
  -- Lower case: a full address or "@domain".
  entry text primary key check (
    entry = lower(entry)
    and char_length(entry) between 4 and 254
    and entry ~ '^[^@[:space:]]*@[^@[:space:]]+$'
  ),
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  message text not null check (char_length(message) between 1 and 2000),
  page text check (char_length(page) <= 200),
  created_at timestamptz not null default now()
);
create index feedback_created_idx on public.feedback (created_at desc);

alter table public.app_settings enable row level security;
alter table public.app_settings force row level security;
alter table public.beta_allowlist enable row level security;
alter table public.beta_allowlist force row level security;
alter table public.feedback enable row level security;
alter table public.feedback force row level security;

-- People read and write only their own feedback; you read all of it in the dashboard (service role).
create policy feedback_select_own on public.feedback
  for select to authenticated using (user_id = auth.uid());
create policy feedback_insert_own on public.feedback
  for insert to authenticated with check (user_id = auth.uid());

-- Whether this email may have an account. Used by the trigger below and by the sign-up route to
-- answer with a clear message before an account is attempted.
create function public.is_email_invited(p_email text) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select value from public.app_settings where key = 'beta_gate'), 'on') = 'off'
    or exists (
      select 1 from public.beta_allowlist a
      where a.entry = lower(p_email)
         or a.entry = '@' || split_part(lower(p_email), '@', 2)
    );
$$;

create function public.enforce_beta_gate() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_email_invited(new.email) then
    raise exception 'beta_invite_only' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger a_beta_gate before insert on auth.users
  for each row execute function public.enforce_beta_gate();

revoke all on public.app_settings, public.beta_allowlist, public.feedback from public, anon, authenticated;
grant select, insert on public.feedback to authenticated;
grant all on public.app_settings, public.beta_allowlist, public.feedback to service_role;
revoke all on function public.is_email_invited(text), public.enforce_beta_gate() from public, anon, authenticated;
grant execute on function public.is_email_invited(text) to service_role;

-- The data export now includes feedback the person sent.
create or replace function public.export_user_data(p_user_id uuid) returns jsonb
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
    'conversations', coalesce((select jsonb_agg(to_jsonb(c)) from public.conversations c where c.owner_id = p_user_id), '[]'::jsonb),
    'conversation_messages', coalesce((select jsonb_agg(to_jsonb(cm)) from public.conversation_messages cm
                          join public.conversations c on c.id = cm.conversation_id where c.owner_id = p_user_id), '[]'::jsonb),
    'conversation_documents', coalesce((select jsonb_agg(to_jsonb(cd)) from public.conversation_documents cd
                          join public.conversations c on c.id = cd.conversation_id where c.owner_id = p_user_id), '[]'::jsonb),
    'credit_ledger', coalesce((select jsonb_agg(to_jsonb(l) order by l.id) from public.credit_ledger l where l.user_id = p_user_id), '[]'::jsonb),
    'feedback', coalesce((select jsonb_agg(to_jsonb(fb) order by fb.created_at) from public.feedback fb where fb.user_id = p_user_id), '[]'::jsonb),
    'audit_log', coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from public.audit_log a where a.user_id = p_user_id), '[]'::jsonb)
  );
$$;
