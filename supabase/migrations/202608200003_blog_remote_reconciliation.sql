-- Reconcile remote Blog data, writes and tenant-scoped media paths.

insert into public.blog_categories(organization_id,name,slug)
select o.id,v.name,v.slug
from public.organizations o
cross join (values
  ('Vendas','vendas'),
  ('Atendimento','atendimento'),
  ('Gestão Comercial','gestao-comercial'),
  ('Marketing','marketing'),
  ('CRM','crm')
) as v(name,slug)
where o.slug='esads-beauty'
on conflict(organization_id,slug) do update set name=excluded.name,updated_at=now();

create or replace function public.save_blog_post(
  post_id uuid,
  post_title text,
  post_slug text,
  post_excerpt text,
  post_content text,
  post_cover_image_path text,
  post_category_id uuid,
  post_seo_title text,
  post_seo_description text
) returns uuid
language plpgsql security definer set search_path=public as $$
declare
  org_id uuid:=public.current_organization_id();
  saved_id uuid;
begin
  if auth.uid() is null or org_id is null then raise exception 'blog_session_required' using errcode='42501'; end if;
  if post_id is null and not public.has_permission('blog.create') then raise exception 'blog_create_denied' using errcode='42501'; end if;
  if post_id is not null and not public.has_permission('blog.edit') then raise exception 'blog_edit_denied' using errcode='42501'; end if;
  if char_length(trim(coalesce(post_title,''))) < 4 then raise exception 'blog_title_invalid' using errcode='23514'; end if;
  if public.blog_slug(coalesce(nullif(post_slug,''),post_title)) = '' then raise exception 'blog_slug_invalid' using errcode='23514'; end if;
  if post_category_id is not null and not exists(
    select 1 from public.blog_categories c where c.id=post_category_id and c.organization_id=org_id
  ) then raise exception 'blog_category_invalid' using errcode='23503'; end if;

  if post_id is null then
    insert into public.blog_posts(
      organization_id,title,slug,excerpt,content,cover_image_path,category_id,
      status,author_id,seo_title,seo_description
    ) values(
      org_id,trim(post_title),public.blog_slug(coalesce(nullif(post_slug,''),post_title)),
      coalesce(post_excerpt,''),coalesce(post_content,''),nullif(post_cover_image_path,''),
      post_category_id,'draft',auth.uid(),nullif(post_seo_title,''),nullif(post_seo_description,'')
    ) returning id into saved_id;
  else
    update public.blog_posts set
      title=trim(post_title),slug=public.blog_slug(coalesce(nullif(post_slug,''),post_title)),
      excerpt=coalesce(post_excerpt,''),content=coalesce(post_content,''),
      cover_image_path=nullif(post_cover_image_path,''),category_id=post_category_id,
      seo_title=nullif(post_seo_title,''),seo_description=nullif(post_seo_description,'')
    where id=post_id and organization_id=org_id and deleted_at is null
    returning id into saved_id;
    if saved_id is null then raise exception 'blog_post_not_found' using errcode='P0002'; end if;
  end if;
  return saved_id;
end $$;

revoke all on function public.save_blog_post(uuid,text,text,text,text,text,uuid,text,text) from public,anon;
grant execute on function public.save_blog_post(uuid,text,text,text,text,text,uuid,text,text) to authenticated;

create or replace function public.set_blog_post_status(post_id uuid, next_status text) returns void
language plpgsql security definer set search_path=public as $$
declare org_id uuid:=public.current_organization_id();
begin
  if auth.uid() is null or org_id is null or not public.has_permission('blog.publish') then
    raise exception 'blog_publish_denied' using errcode='42501';
  end if;
  if next_status not in ('draft','published','archived') then
    raise exception 'blog_status_invalid' using errcode='23514';
  end if;
  update public.blog_posts
  set status=next_status,published_at=case when next_status='published' then coalesce(published_at,now()) else null end
  where id=post_id and organization_id=org_id and deleted_at is null;
  if not found then raise exception 'blog_post_not_found' using errcode='P0002'; end if;
end $$;
revoke all on function public.set_blog_post_status(uuid,text) from public,anon;
grant execute on function public.set_blog_post_status(uuid,text) to authenticated;

drop policy if exists blog_media_editor_insert on storage.objects;
drop policy if exists blog_media_editor_update on storage.objects;
drop policy if exists blog_media_editor_delete on storage.objects;
create policy blog_media_editor_insert on storage.objects for insert to authenticated
with check(
  bucket_id='blog' and auth.uid() is not null and public.has_permission('blog.edit')
  and (storage.foldername(name))[1]=public.current_organization_id()::text
);
create policy blog_media_editor_update on storage.objects for update to authenticated
using(
  bucket_id='blog' and auth.uid() is not null and public.has_permission('blog.edit')
  and (storage.foldername(name))[1]=public.current_organization_id()::text
)
with check(
  bucket_id='blog' and auth.uid() is not null and public.has_permission('blog.edit')
  and (storage.foldername(name))[1]=public.current_organization_id()::text
);
create policy blog_media_editor_delete on storage.objects for delete to authenticated
using(
  bucket_id='blog' and auth.uid() is not null and public.has_permission('blog.delete')
  and (storage.foldername(name))[1]=public.current_organization_id()::text
);

notify pgrst, 'reload schema';
