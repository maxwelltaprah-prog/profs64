-- Two small stores added together:
--  * conversation_images: pictures a person attaches in the assistant chat so a deck can use them.
--  * project_records: the built-in data store for generated apps (see docs/ARCHITECTURE.md).
-- Both follow the repo rules: RLS forced, owner-only through the parent row, hard size and count
-- caps checked under a row lock on the parent, trigger functions not callable by clients.

create table public.conversation_images (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  mime text not null check (mime in ('image/png', 'image/jpeg')),
  width integer not null check (width between 1 and 8000),
  height integer not null check (height between 1 and 8000),
  data text not null check (char_length(data) <= 2796203),  -- base64 of at most 2 MB
  created_at timestamptz not null default now()
);
create index conversation_images_conv_idx on public.conversation_images (conversation_id, created_at);

create table public.project_records (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  collection text not null check (collection ~ '^[a-z0-9_-]{1,40}$'),
  data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 16384),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index project_records_coll_idx on public.project_records (project_id, collection, created_at);

create function public.enforce_conversation_image_cap() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.conversations where id = new.conversation_id for update;
  if (select count(*) from public.conversation_images where conversation_id = new.conversation_id) >= 20 then
    raise exception 'image limit reached' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger conversation_images_cap before insert on public.conversation_images
  for each row execute function public.enforce_conversation_image_cap();

create function public.enforce_project_record_cap() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.projects where id = new.project_id for update;
  if (select count(*) from public.project_records where project_id = new.project_id) >= 1000 then
    raise exception 'record limit reached' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger project_records_cap before insert on public.project_records
  for each row execute function public.enforce_project_record_cap();

revoke execute on function
  public.enforce_conversation_image_cap(),
  public.enforce_project_record_cap()
from public, anon, authenticated;

revoke all on public.conversation_images, public.project_records from public, anon, authenticated;
grant select, insert on public.conversation_images to authenticated;
grant select, insert, update, delete on public.project_records to authenticated;
grant all on public.conversation_images, public.project_records to service_role;

alter table public.conversation_images enable row level security;
alter table public.project_records enable row level security;
alter table public.conversation_images force row level security;
alter table public.project_records force row level security;

create policy service_role_all_conversation_images on public.conversation_images
  for all to service_role using (true) with check (true);
create policy service_role_all_project_records on public.project_records
  for all to service_role using (true) with check (true);

create policy conversation_images_select_own on public.conversation_images
  for select to authenticated
  using (exists (select 1 from public.conversations c
                 where c.id = conversation_id and c.owner_id = (select auth.uid())));
create policy conversation_images_insert_own on public.conversation_images
  for insert to authenticated
  with check (exists (select 1 from public.conversations c
                      where c.id = conversation_id and c.owner_id = (select auth.uid())));

create policy project_records_select_own on public.project_records
  for select to authenticated
  using (exists (select 1 from public.projects p
                 where p.id = project_id and p.owner_id = (select auth.uid())));
create policy project_records_insert_own on public.project_records
  for insert to authenticated
  with check (exists (select 1 from public.projects p
                      where p.id = project_id and p.owner_id = (select auth.uid())));
create policy project_records_update_own on public.project_records
  for update to authenticated
  using (exists (select 1 from public.projects p
                 where p.id = project_id and p.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.projects p
                      where p.id = project_id and p.owner_id = (select auth.uid())));
create policy project_records_delete_own on public.project_records
  for delete to authenticated
  using (exists (select 1 from public.projects p
                 where p.id = project_id and p.owner_id = (select auth.uid())));
