-- Reverses 20261107000001_init.sql. Destroys all application data.

drop trigger if exists on_auth_user_created on auth.users;

drop function if exists public.handle_new_user();
drop function if exists public.export_user_data(uuid);
drop function if exists public.record_audit_event(uuid, text, jsonb, text);
drop function if exists public.credits_spent_today(uuid);
drop function if exists public.deduct_credits(uuid, numeric, uuid, text, integer, integer, numeric);
drop function if exists public.record_credit_change(uuid, numeric, text, uuid, text, integer, integer, numeric);

-- Dropping the tables removes their triggers; the append-only trigger would otherwise block DROP.
drop table if exists public.audit_log;
drop table if exists public.credit_ledger;
drop table if exists public.messages;
drop table if exists public.project_files;
drop table if exists public.projects;
drop table if exists public.profiles;

drop function if exists public.audit_project_deleted();
drop function if exists public.enforce_project_cap();
drop function if exists public.enforce_message_cap();
drop function if exists public.forbid_mutation();
drop function if exists public.enforce_file_cap();
drop function if exists public.bump_project_on_file_change();
drop function if exists public.touch_updated_at();

alter default privileges in schema public grant execute on functions to public;
