alter table public.whatsapp_messages
  add column if not exists media_transcript text,
  add column if not exists media_transcription_status text;
