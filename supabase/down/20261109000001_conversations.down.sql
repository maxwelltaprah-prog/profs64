-- Reverses 20261109000001_conversations.sql. Destroys all conversations and their documents.

drop table if exists public.conversation_documents;
drop table if exists public.conversation_messages;
drop table if exists public.conversations;
drop function if exists public.enforce_conversation_document_cap();
drop function if exists public.enforce_conversation_message_cap();
drop function if exists public.enforce_conversation_cap();

-- Restore the export without conversations.
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
    'credit_ledger', coalesce((select jsonb_agg(to_jsonb(l) order by l.id) from public.credit_ledger l where l.user_id = p_user_id), '[]'::jsonb),
    'audit_log', coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from public.audit_log a where a.user_id = p_user_id), '[]'::jsonb)
  );
$$;
