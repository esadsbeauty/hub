alter table public.whatsapp_messages
  add column if not exists delivery_status text,
  add column if not exists delivered_at timestamptz,
  add column if not exists read_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists reply_to_external_message_id text;

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg','image/png','image/webp',
  'audio/ogg','audio/mpeg','audio/mp4','audio/aac','audio/amr','audio/opus','audio/webm',
  'video/mp4','video/3gpp','video/quicktime','video/webm',
  'application/pdf','application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain','text/csv','application/zip'
]::text[]
where id='whatsapp-media';
