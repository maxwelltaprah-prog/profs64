-- Organize (pin projects and conversations) and share (a public read-only preview link per
-- project). Pins are a nullable timestamp; a project is shared when it has a share_slug. RLS is
-- unchanged: owners already update their own rows. The public preview reads a shared project's
-- files through one security-definer function that returns data only for a shared project.

alter table public.projects add column if not exists pinned_at timestamptz;
alter table public.projects add column if not exists share_slug text unique;
alter table public.conversations add column if not exists pinned_at timestamptz;

-- Conversations only granted column-level update before; allow toggling the pin too.
grant update (pinned_at) on public.conversations to authenticated;

create index if not exists projects_owner_pinned_idx
  on public.projects (owner_id, pinned_at desc nulls last, updated_at desc);
create index if not exists conversations_owner_pinned_idx
  on public.conversations (owner_id, pinned_at desc nulls last, updated_at desc);

-- A shared project's name and files, by slug. SECURITY DEFINER so a signed-out visitor can read
-- it, but it returns nothing unless the project has a share_slug set, so unshared projects stay
-- private. Read-only: it never exposes owner, messages, credits or anything but the files needed
-- to render the preview.
create or replace function public.get_shared_project(p_slug text)
returns table (name text, files jsonb)
language sql
security definer
stable
set search_path = ''
as $$
  select p.name,
         coalesce(
           (select jsonb_agg(jsonb_build_object('path', f.path, 'content', f.content) order by f.path)
            from public.project_files f where f.project_id = p.id),
           '[]'::jsonb
         )
  from public.projects p
  where p.share_slug is not null
    and p.share_slug = p_slug
  limit 1;
$$;

revoke all on function public.get_shared_project(text) from public;
grant execute on function public.get_shared_project(text) to anon, authenticated;
