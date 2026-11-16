-- Reverses 20261116000002_beta_gate_and_feedback.sql.
drop trigger if exists a_beta_gate on auth.users;
drop function if exists public.enforce_beta_gate();
drop function if exists public.is_email_invited(text);
-- Restore the export function as it was before feedback existed.
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
drop table if exists public.feedback;
drop table if exists public.beta_allowlist;
drop table if exists public.app_settings;
