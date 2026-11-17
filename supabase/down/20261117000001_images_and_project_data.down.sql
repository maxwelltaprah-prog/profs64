-- Reverses 20261117000001_images_and_project_data.sql.
drop table if exists public.project_records;
drop table if exists public.conversation_images;
drop function if exists public.enforce_project_record_cap();
drop function if exists public.enforce_conversation_image_cap();
