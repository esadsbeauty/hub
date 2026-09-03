-- User-owned avatars. Tenant branding remains intentionally unsupported.
alter table public.profiles add column if not exists avatar_path text;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('avatars','avatars',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy avatars_own_insert on storage.objects for insert to authenticated
with check(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy avatars_own_select on storage.objects for select to authenticated
using(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy avatars_own_update on storage.objects for update to authenticated
using(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text)
with check(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy avatars_own_delete on storage.objects for delete to authenticated
using(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);

create or replace function public.current_user_profile()
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object('id',p.id,'name',p.name,'email',p.email,'avatar_path',p.avatar_path,'avatar_url',p.avatar_url)
  from public.profiles p where p.id=auth.uid()
$$;

create or replace function public.update_own_profile(profile_name text,next_avatar_path text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid();clean_name text:=trim(profile_name);result jsonb;
begin
  if actor is null then raise exception 'authentication_required' using errcode='42501';end if;
  if clean_name='' or length(clean_name)>120 then raise exception 'invalid_profile_name' using errcode='22023';end if;
  if next_avatar_path is not null and next_avatar_path!~('^'||actor::text||'/avatar\.(jpg|jpeg|png|webp)$') then
    raise exception 'invalid_avatar_path' using errcode='22023';
  end if;
  update public.profiles set name=clean_name,avatar_path=next_avatar_path,updated_at=now() where id=actor;
  if not found then raise exception 'profile_not_found' using errcode='P0002';end if;
  select jsonb_build_object('id',p.id,'name',p.name,'email',p.email,'avatar_path',p.avatar_path,'avatar_url',p.avatar_url) into result from public.profiles p where p.id=actor;
  return result;
end$$;

revoke all on function public.current_user_profile(),public.update_own_profile(text,text) from public,anon;
grant execute on function public.current_user_profile(),public.update_own_profile(text,text) to authenticated;
notify pgrst,'reload schema';
