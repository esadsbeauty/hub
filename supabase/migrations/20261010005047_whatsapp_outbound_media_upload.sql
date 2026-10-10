update storage.buckets
set
  file_size_limit = 26214400,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'audio/ogg',
    'audio/mpeg',
    'audio/mp4',
    'audio/aac',
    'audio/amr',
    'audio/opus',
    'audio/webm',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'application/zip'
  ]::text[]
where id = 'whatsapp-media';

drop policy if exists whatsapp_media_org_insert on storage.objects;
create policy whatsapp_media_org_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'whatsapp-media'
  and (storage.foldername(name))[1] = public.current_organization_id()::text
);

drop policy if exists whatsapp_media_org_update on storage.objects;
create policy whatsapp_media_org_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'whatsapp-media'
  and (storage.foldername(name))[1] = public.current_organization_id()::text
)
with check (
  bucket_id = 'whatsapp-media'
  and (storage.foldername(name))[1] = public.current_organization_id()::text
);

drop policy if exists whatsapp_media_org_delete on storage.objects;
create policy whatsapp_media_org_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'whatsapp-media'
  and (storage.foldername(name))[1] = public.current_organization_id()::text
);
