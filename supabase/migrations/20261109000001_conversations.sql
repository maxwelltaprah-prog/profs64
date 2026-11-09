-- Chat agent: general conversations (not tied to a project), their messages, and the documents
-- the assistant creates in them. Same rules as the rest of the schema: RLS forced on every table,
-- owners read their own rows, assistant output and documents are written only by the server.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index conversations_owner_updated_idx on public.conversations (owner_id, updated_at desc);

create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  parts jsonb not null check (jsonb_typeof(parts) = 'array' and octet_length(parts::text) <= 1048576),
  created_at timestamptz not null default now()
);
create index conversation_messages_created_idx
  on public.conversation_messages (conversation_id, created_at);

-- A document is stored as the validated outline the assistant wrote; the .pptx, .docx or .pdf is
-- rendered from it on download, so no binary files are stored.
create table public.conversation_documents (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  kind text not null check (kind in ('pptx', 'docx', 'pdf')),
  title text not null check (char_length(title) between 1 and 120),
  spec jsonb not null check (jsonb_typeof(spec) = 'object' and octet_length(spec::text) <= 262144),
  created_at timestamptz not null default now()
);
create index conversation_documents_created_idx
  on public.conversation_documents (conversation_id, created_at);

-- Caps, checked under a row lock on the parent so concurrent inserts cannot slip past them.
create function public.enforce_conversation_cap() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.profiles where id = new.owner_id for update;
  if (select count(*) from public.conversations where owner_id = new.owner_id) >= 500 then
    raise exception 'conversation count limit reached' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger conversations_cap before insert on public.conversations
  for each row execute function public.enforce_conversation_cap();

create function public.enforce_conversation_message_cap() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.conversations where id = new.conversation_id for update;
  if (select count(*) from public.conversation_messages where conversation_id = new.conversation_id) >= 2000 then
    raise exception 'conversation limit reached' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger conversation_messages_cap before insert on public.conversation_messages
  for each row execute function public.enforce_conversation_message_cap();

create function public.enforce_conversation_document_cap() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.conversations where id = new.conversation_id for update;
  if (select count(*) from public.conversation_documents where conversation_id = new.conversation_id) >= 100 then
    raise exception 'document limit reached' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger conversation_documents_cap before insert on public.conversation_documents
  for each row execute function public.enforce_conversation_document_cap();

-- Trigger functions run as their owner; nobody calls them directly.
revoke execute on function
  public.enforce_conversation_cap(),
  public.enforce_conversation_message_cap(),
  public.enforce_conversation_document_cap()
from public, anon, authenticated;

-- Privileges: the default-deny from the init migration covers new tables only through these grants.
revoke all on public.conversations, public.conversation_messages, public.conversation_documents
  from public, anon, authenticated;
grant select, insert, delete on public.conversations to authenticated;
grant update (title, updated_at) on public.conversations to authenticated;
grant select, insert on public.conversation_messages to authenticated;
grant select on public.conversation_documents to authenticated;
grant all on public.conversations, public.conversation_messages, public.conversation_documents
  to service_role;

alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.conversation_documents enable row level security;
alter table public.conversations force row level security;
alter table public.conversation_messages force row level security;
alter table public.conversation_documents force row level security;

create policy service_role_all_conversations on public.conversations
  for all to service_role using (true) with check (true);
create policy service_role_all_conversation_messages on public.conversation_messages
  for all to service_role using (true) with check (true);
create policy service_role_all_conversation_documents on public.conversation_documents
  for all to service_role using (true) with check (true);

create policy conversations_select_own on public.conversations for select to authenticated
  using (owner_id = (select auth.uid()));
create policy conversations_insert_own on public.conversations for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy conversations_update_own on public.conversations for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy conversations_delete_own on public.conversations for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy conversation_messages_select_own on public.conversation_messages
  for select to authenticated
  using (exists (select 1 from public.conversations c
                 where c.id = conversation_id and c.owner_id = (select auth.uid())));
-- Only 'user' messages from the API; assistant replies are written by the server.
create policy conversation_messages_insert_user on public.conversation_messages
  for insert to authenticated
  with check (
    role = 'user'
    and exists (select 1 from public.conversations c
                where c.id = conversation_id and c.owner_id = (select auth.uid()))
  );

create policy conversation_documents_select_own on public.conversation_documents
  for select to authenticated
  using (exists (select 1 from public.conversations c
                 where c.id = conversation_id and c.owner_id = (select auth.uid())));

-- Data export includes conversations, their messages and documents.
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
    'audit_log', coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from public.audit_log a where a.user_id = p_user_id), '[]'::jsonb)
  );
$$;
