alter table public.whatsapp_messages
  add column if not exists media_id text,
  add column if not exists media_path text,
  add column if not exists media_mime_type text,
  add column if not exists media_file_name text,
  add column if not exists media_size_bytes bigint;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'whatsapp-media',
  'whatsapp-media',
  false,
  26214400,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'audio/ogg',
    'audio/mpeg',
    'audio/mp4',
    'audio/aac',
    'audio/amr',
    'audio/opus'
  ]::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists whatsapp_media_org_read on storage.objects;

create policy whatsapp_media_org_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'whatsapp-media'
  and (storage.foldername(name))[1] = public.current_organization_id()::text
);
