-- Reverses 20261116000001_organize_and_share.sql.
drop function if exists public.get_shared_project(text);
drop index if exists public.projects_owner_pinned_idx;
drop index if exists public.conversations_owner_pinned_idx;
alter table public.conversations drop column if exists pinned_at;
alter table public.projects drop column if exists share_slug;
alter table public.projects drop column if exists pinned_at;
